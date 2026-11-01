import { and, asc, eq, isNull, or } from "drizzle-orm";

import type { Db } from "@/db";
import { accounts, galleries, galleryMedia, media, themes } from "@/db/schema";
import { LOGO_URL_TTL_SECONDS } from "@/lib/branding";
import { allows } from "@/lib/download-policy";
import { verifyAccessToken } from "@/lib/gallery-access";
import type { PhotoVariants } from "@/lib/photos";
import type { Storage } from "@/lib/storage/types";
import type { VideoProvider } from "@/lib/video/types";
import {
  DEFAULT_THEME,
  themeConfigSchema,
  type ThemeConfig,
} from "@/lib/themes";

type Deps = {
  db: Db;
  storage: Storage;
  video?: VideoProvider;
  now?: Date;
  /** Cookie value of this gallery's access cookie, if the visitor has one. */
  accessToken?: (galleryId: string) => string | undefined;
  /** Secret signing access cookies; without it, protected galleries stay locked. */
  accessSecret?: string;
};

/** Shown instead of the gallery until the visitor entered the password. */
export type LockedGallery = {
  locked: true;
  slug: string;
  title: string;
};

export type PublicGallery = {
  locked: false;
  id: string;
  slug: string;
  accountId: string;
  title: string;
  description: string | null;
  eventDate: Date | null;
  config: ThemeConfig;
  logoUrl: string | null;
  coverUrl: string | null;
  /** Cover variants as `srcset`, so small screens do not load the largest one. */
  coverSrcSet: string | null;
  items: PublicItem[];
};

export type PublicPhoto = {
  kind: "photo";
  id: string;
  src: string;
  srcSet: string;
  width: number;
  height: number;
  /** Download links the effective policy permits; absent = not allowed. */
  downloads: { web?: string; original?: string };
};
export type PublicVideo = {
  kind: "video";
  id: string;
  durationS: number | null;
  width: number | null;
  height: number | null;
  /** Signed, short-lived embed URL; only loaded once the visitor presses play. */
  playUrl: string;
  /** Signed HLS playlist for the own player; absent → embed iframe. */
  hlsUrl?: string;
  /** Signed poster image; absent → placeholder tile. */
  posterUrl?: string;
};
export type PublicItem = PublicPhoto | PublicVideo;

export const PHOTO_URL_TTL_SECONDS = 60 * 60;
export const VIDEO_URL_TTL_SECONDS = 4 * 60 * 60;

function parseConfig(raw: unknown): ThemeConfig | null {
  const r = themeConfigSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * Resolves a gallery by its public slug. The slug is the only tenant-free
 * lookup in the app; everything else is read with the owning accountId taken
 * from the found row. Returns null unless the gallery is published and not
 * expired, so drafts, expired and archived galleries are indistinguishable
 * from missing ones.
 */
export async function loadPublicGallery(
  deps: Deps,
  slug: string,
): Promise<PublicGallery | LockedGallery | null> {
  const now = deps.now ?? new Date();
  const [gallery] = await deps.db
    .select()
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);
  if (!gallery || gallery.status !== "published") return null;
  if (gallery.expiresAt && gallery.expiresAt <= now) return null;

  if (gallery.passwordHash) {
    const granted =
      deps.accessSecret &&
      verifyAccessToken(
        deps.accessSecret,
        { id: gallery.id, passwordHash: gallery.passwordHash },
        deps.accessToken?.(gallery.id),
        now,
      );
    if (!granted) {
      return { locked: true, slug: gallery.slug, title: gallery.title };
    }
  }

  const accountId = gallery.accountId;
  // a theme is a system theme (accountId null) or one of this account
  const [theme] = gallery.themeId
    ? await deps.db
        .select()
        .from(themes)
        .where(
          and(
            eq(themes.id, gallery.themeId),
            or(isNull(themes.accountId), eq(themes.accountId, accountId)),
          ),
        )
        .limit(1)
    : [];
  const config =
    parseConfig(gallery.themeOverrides) ??
    parseConfig(theme?.config) ??
    DEFAULT_THEME.config;

  const [account] = await deps.db
    .select({ branding: accounts.branding })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  const logoKey = account?.branding.logoKey;
  const stamped = gallery.watermarkEnabled && typeof logoKey === "string";
  const logoUrl =
    typeof logoKey === "string"
      ? await deps.storage.signGet(logoKey, LOGO_URL_TTL_SECONDS)
      : null;

  // photos and videos in the gallery's own order (gallery_media.position)
  const rows = await deps.db
    .select({ media })
    .from(galleryMedia)
    .innerJoin(media, eq(media.id, galleryMedia.mediaId))
    .where(
      and(
        eq(galleryMedia.accountId, accountId),
        eq(galleryMedia.galleryId, gallery.id),
        eq(media.accountId, accountId),
        eq(media.processingStatus, "ready"),
      ),
    )
    .orderBy(asc(galleryMedia.position), asc(media.createdAt));

  const items: PublicItem[] = [];
  let coverUrl: string | null = null;
  let coverSrcSet: string | null = null;
  for (const { media: m } of rows) {
    if (m.type === "video") {
      if (!deps.video || !m.bunnyVideoId) continue;
      items.push({
        kind: "video",
        id: m.id,
        durationS: m.durationS,
        width: m.width,
        height: m.height,
        playUrl: deps.video.signPlaybackUrl(
          m.bunnyVideoId,
          VIDEO_URL_TTL_SECONDS,
        ),
        hlsUrl:
          deps.video.signHlsUrl(m.bunnyVideoId, VIDEO_URL_TTL_SECONDS) ??
          undefined,
        posterUrl:
          deps.video.signThumbnailUrl(m.bunnyVideoId, VIDEO_URL_TTL_SECONDS) ??
          undefined,
      });
      continue;
    }
    const variants = Object.entries(m.variants as PhotoVariants)
      .map(([nominal, v]) => ({ ...v, nominal }))
      .sort(
        (x, y) => x.width - y.width || Number(x.nominal) - Number(y.nominal),
      );
    if (!variants.length) continue;
    const signed = await Promise.all(
      variants.map(async (v) => ({
        ...v,
        // watermarked galleries go through the stamping route (F-SEC-03)
        url: stamped
          ? `/api/g/${encodeURIComponent(gallery.slug)}/img/${m.id}?w=${v.nominal}`
          : await deps.storage.signGet(v.key, PHOTO_URL_TTL_SECONDS),
      })),
    );
    // default src: the mid-size variant (second smallest, else the only one)
    const mid = signed[Math.min(1, signed.length - 1)];
    const photo: PublicPhoto = {
      kind: "photo",
      id: m.id,
      src: mid.url,
      srcSet: signed.map((v) => `${v.url} ${v.width}w`).join(", "),
      width: m.width ?? mid.width,
      height: m.height ?? mid.height,
      downloads: {},
    };
    const base = `/api/g/${encodeURIComponent(gallery.slug)}/download/${m.id}`;
    if (allows(gallery.downloadPolicy, "web")) {
      photo.downloads.web = `${base}?size=web`;
    }
    if (allows(gallery.downloadPolicy, "original") && m.originalKey) {
      photo.downloads.original = `${base}?size=original`;
    }
    if (m.id === gallery.coverMediaId) {
      coverUrl = signed.at(-1)!.url;
      coverSrcSet = photo.srcSet;
    }
    items.push(photo);
  }

  return {
    locked: false,
    id: gallery.id,
    slug: gallery.slug,
    accountId,
    title: gallery.title,
    description: gallery.description,
    eventDate: gallery.eventDate,
    config,
    logoUrl,
    coverUrl,
    coverSrcSet,
    items,
  };
}
