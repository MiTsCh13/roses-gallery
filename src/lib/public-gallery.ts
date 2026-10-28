import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import type { Db } from "@/db";
import { accounts, galleries, media, sets, themes } from "@/db/schema";
import { LOGO_URL_TTL_SECONDS } from "@/lib/branding";
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
  accountId: string;
  title: string;
  eventDate: Date | null;
  config: ThemeConfig;
  logoUrl: string | null;
  coverUrl: string | null;
  /** Cover variants as `srcset`, so small screens do not load the largest one. */
  coverSrcSet: string | null;
  sets: PublicSet[];
};

export type PublicPhoto = {
  id: string;
  src: string;
  srcSet: string;
  width: number;
  height: number;
};
export type PublicVideo = {
  id: string;
  durationS: number | null;
  /** Signed, short-lived embed URL; only loaded once the visitor presses play. */
  playUrl: string;
  /** Signed HLS playlist for the own player; absent → embed iframe. */
  hlsUrl?: string;
};
export type PublicSet = {
  id: string;
  title: string;
  type: "photo" | "video";
  photos: PublicPhoto[];
  videos: PublicVideo[];
};

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
  const logoUrl =
    typeof logoKey === "string"
      ? await deps.storage.signGet(logoKey, LOGO_URL_TTL_SECONDS)
      : null;

  const rows = await deps.db
    .select({ id: sets.id, title: sets.title, type: sets.type })
    .from(sets)
    .where(and(eq(sets.accountId, accountId), eq(sets.galleryId, gallery.id)))
    .orderBy(asc(sets.position));

  const ready = rows.length
    ? await deps.db
        .select()
        .from(media)
        .where(
          and(
            eq(media.accountId, accountId),
            inArray(
              media.setId,
              rows.map((r) => r.id),
            ),
            eq(media.type, "photo"),
            eq(media.processingStatus, "ready"),
          ),
        )
        .orderBy(asc(media.position), asc(media.createdAt))
    : [];
  const readyVideos =
    rows.length && deps.video
      ? await deps.db
          .select()
          .from(media)
          .where(
            and(
              eq(media.accountId, accountId),
              inArray(
                media.setId,
                rows.map((r) => r.id),
              ),
              eq(media.type, "video"),
              eq(media.processingStatus, "ready"),
              isNotNull(media.bunnyVideoId),
            ),
          )
          .orderBy(asc(media.position), asc(media.createdAt))
      : [];
  const videosBySet = new Map<string, PublicVideo[]>();
  for (const v of readyVideos) {
    videosBySet.set(v.setId, [
      ...(videosBySet.get(v.setId) ?? []),
      {
        id: v.id,
        durationS: v.durationS,
        playUrl: deps.video!.signPlaybackUrl(
          v.bunnyVideoId!,
          VIDEO_URL_TTL_SECONDS,
        ),
        hlsUrl:
          deps.video!.signHlsUrl(v.bunnyVideoId!, VIDEO_URL_TTL_SECONDS) ??
          undefined,
      },
    ]);
  }
  const setIds = new Set(rows.map((r) => r.id));
  const bySet = new Map<string, PublicPhoto[]>();
  let coverUrl: string | null = null;
  let coverSrcSet: string | null = null;
  for (const m of ready) {
    if (!setIds.has(m.setId)) continue;
    const variants = Object.values(m.variants as PhotoVariants).sort(
      (x, y) => x.width - y.width,
    );
    if (!variants.length) continue;
    const signed = await Promise.all(
      variants.map(async (v) => ({
        ...v,
        url: await deps.storage.signGet(v.key, PHOTO_URL_TTL_SECONDS),
      })),
    );
    // default src: the mid-size variant (second smallest, else the only one)
    const mid = signed[Math.min(1, signed.length - 1)];
    const photo: PublicPhoto = {
      id: m.id,
      src: mid.url,
      srcSet: signed.map((v) => `${v.url} ${v.width}w`).join(", "),
      width: m.width ?? mid.width,
      height: m.height ?? mid.height,
    };
    if (m.id === gallery.coverMediaId) {
      coverUrl = signed.at(-1)!.url;
      coverSrcSet = photo.srcSet;
    }
    bySet.set(m.setId, [...(bySet.get(m.setId) ?? []), photo]);
  }

  return {
    locked: false,
    id: gallery.id,
    accountId,
    title: gallery.title,
    eventDate: gallery.eventDate,
    config,
    logoUrl,
    coverUrl,
    coverSrcSet,
    sets: rows.map((r) => ({
      ...r,
      photos: bySet.get(r.id) ?? [],
      videos: videosBySet.get(r.id) ?? [],
    })),
  };
}
