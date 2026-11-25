import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { galleries, galleryMedia, media } from "@/db/schema";
import { allows } from "@/lib/download-policy";
import { recordEvent } from "@/lib/events";
import { ensureWatermarked } from "@/lib/watermark";
import { verifyAccessToken } from "@/lib/gallery-access";
import type { PhotoVariants } from "@/lib/photos";
import type { Storage } from "@/lib/storage/types";
import type { VideoProvider } from "@/lib/video/types";

export const DOWNLOAD_URL_TTL_SECONDS = 60;
/** Filme sind groß: der Link muss bis zum Start des Downloads gültig sein. */
export const VIDEO_DOWNLOAD_URL_TTL_SECONDS = 300;

export type DownloadResult =
  { ok: true; url: string } | { ok: false; reason: "not_found" | "forbidden" };

type Deps = {
  db: Db;
  storage: Storage;
  video?: VideoProvider;
  accessSecret?: string;
  accessToken?: (galleryId: string) => string | undefined;
  now?: Date;
};

/**
 * The gallery behind a public slug, if the visitor may see it: published, not
 * expired and (when password protected) unlocked.
 */
export async function findVisibleGallery(
  deps: Pick<Deps, "db" | "accessSecret" | "accessToken">,
  slug: string,
  now: Date,
) {
  const [gallery] = await deps.db
    .select()
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);
  if (!gallery || gallery.status !== "published") return null;
  if (gallery.expiresAt && gallery.expiresAt <= now) return null;
  if (
    gallery.passwordHash &&
    !(
      deps.accessSecret &&
      verifyAccessToken(
        deps.accessSecret,
        { id: gallery.id, passwordHash: gallery.passwordHash },
        deps.accessToken?.(gallery.id),
        now,
      )
    )
  ) {
    return null;
  }
  return gallery;
}

/**
 * Signed download URL for one photo or video of a public gallery. Applies the
 * same visibility rules as the gallery itself (published, not expired,
 * password) plus the effective download policy. Photos: web size or original,
 * URL lives one minute. Videos (D-163): only the original and only with policy
 * „original“, as a signed Bunny link (five minutes).
 */
export async function resolvePhotoDownload(
  deps: Deps,
  input: { slug: string; mediaId: string; size: "web" | "original" },
): Promise<DownloadResult> {
  if (!z.uuid().safeParse(input.mediaId).success) {
    return { ok: false, reason: "not_found" };
  }
  const now = deps.now ?? new Date();
  const gallery = await findVisibleGallery(deps, input.slug, now);
  if (!gallery) return { ok: false, reason: "not_found" };

  const [row] = await deps.db
    .select({ media })
    .from(media)
    .innerJoin(galleryMedia, eq(galleryMedia.mediaId, media.id))
    .where(
      and(
        eq(media.id, input.mediaId),
        eq(media.accountId, gallery.accountId),
        eq(galleryMedia.galleryId, gallery.id),
        eq(media.processingStatus, "ready"),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, reason: "not_found" };

  if (row.media.type === "video") {
    if (!deps.video || !row.media.bunnyVideoId) {
      return { ok: false, reason: "not_found" };
    }
    // Für Videos gibt es keine Web-Größe, nur das Original.
    if (
      input.size !== "original" ||
      !allows(gallery.downloadPolicy, "original")
    ) {
      return { ok: false, reason: "forbidden" };
    }
    const url = deps.video.signOriginalUrl(
      row.media.bunnyVideoId,
      VIDEO_DOWNLOAD_URL_TTL_SECONDS,
    );
    await recordEvent(deps.db, gallery, "download", row.media.id);
    return { ok: true, url };
  }

  if (!allows(gallery.downloadPolicy, input.size)) {
    return { ok: false, reason: "forbidden" };
  }

  let key: string | null;
  let ext = "";
  if (input.size === "original") {
    key = row.media.originalKey;
  } else {
    const [nominal, largest] =
      Object.entries(row.media.variants as PhotoVariants).sort(
        ([a], [b]) => Number(b) - Number(a),
      )[0] ?? [];
    key = largest?.key ?? null;
    ext = ".webp";
    if (key && gallery.watermarkEnabled) {
      const stamped = await ensureWatermarked(deps, {
        accountId: gallery.accountId,
        media: row.media,
        width: Number(nominal),
      });
      if (stamped) key = stamped.key;
    }
  }
  if (!key) return { ok: false, reason: "not_found" };

  const siblings = await deps.db
    .select({ id: media.id })
    .from(galleryMedia)
    .innerJoin(media, eq(media.id, galleryMedia.mediaId))
    .where(
      and(
        eq(galleryMedia.accountId, gallery.accountId),
        eq(galleryMedia.galleryId, gallery.id),
        eq(media.type, "photo"),
        eq(media.processingStatus, "ready"),
      ),
    )
    .orderBy(asc(galleryMedia.position), asc(media.createdAt));
  const n = siblings.findIndex((m) => m.id === row.media.id) + 1;
  const suffix = input.size === "original" ? "-original" : "";
  const url = await deps.storage.signGet(key, DOWNLOAD_URL_TTL_SECONDS, {
    downloadName: `${gallery.slug}-${n}${suffix}${ext}`,
  });
  await recordEvent(deps.db, gallery, "download", row.media.id);
  return { ok: true, url };
}
