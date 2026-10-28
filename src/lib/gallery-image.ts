import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { media, sets } from "@/db/schema";
import { findVisibleGallery } from "@/lib/downloads";
import type { PhotoVariants } from "@/lib/photos";
import type { Storage } from "@/lib/storage/types";
import type { DownloadPolicy } from "@/lib/download-policy";
import { ensureWatermarked } from "@/lib/watermark";

export const GALLERY_IMAGE_URL_TTL_SECONDS = 60 * 60;

export type GalleryImageResult = { ok: true; url: string } | { ok: false };

type ImageDeps = {
  db: Db;
  storage: Storage;
  accessSecret?: string;
  accessToken?: (galleryId: string) => string | undefined;
  now?: Date;
};

type ImageKey =
  | {
      ok: true;
      key: string;
      gallery: NonNullable<Awaited<ReturnType<typeof findVisibleGallery>>>;
      setPolicy: DownloadPolicy | null;
    }
  | { ok: false };

/**
 * Storage key of one photo width of a public gallery: the watermarked copy
 * when the gallery enables it, else the plain variant. Same visibility rules
 * as the gallery itself.
 */
export async function resolveImageKey(
  deps: ImageDeps,
  input: { slug: string; mediaId: string; width: number },
): Promise<ImageKey> {
  if (!z.uuid().safeParse(input.mediaId).success) return { ok: false };
  const gallery = await findVisibleGallery(
    deps,
    input.slug,
    deps.now ?? new Date(),
  );
  if (!gallery) return { ok: false };
  const [row] = await deps.db
    .select({ media, setPolicy: sets.downloadPolicy })
    .from(media)
    .innerJoin(sets, eq(sets.id, media.setId))
    .where(
      and(
        eq(media.id, input.mediaId),
        eq(media.accountId, gallery.accountId),
        eq(sets.galleryId, gallery.id),
        eq(media.type, "photo"),
        eq(media.processingStatus, "ready"),
      ),
    )
    .limit(1);
  if (!row) return { ok: false };
  const variant = (row.media.variants as PhotoVariants)[String(input.width)];
  if (!variant) return { ok: false };
  let key = variant.key;
  if (gallery.watermarkEnabled) {
    const stamped = await ensureWatermarked(deps, {
      accountId: gallery.accountId,
      media: row.media,
      width: input.width,
    });
    if (stamped) key = stamped.key;
  }
  return { ok: true, key, gallery, setPolicy: row.setPolicy };
}

/** Signed URL for one photo width of a public gallery. */
export async function resolveGalleryImage(
  deps: ImageDeps,
  input: { slug: string; mediaId: string; width: number },
): Promise<GalleryImageResult> {
  const r = await resolveImageKey(deps, input);
  if (!r.ok) return { ok: false };
  return {
    ok: true,
    url: await deps.storage.signGet(r.key, GALLERY_IMAGE_URL_TTL_SECONDS),
  };
}
