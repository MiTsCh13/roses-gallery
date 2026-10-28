import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { galleries, media, sets } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import {
  allows,
  downloadPolicySchema,
  effectivePolicy,
} from "@/lib/download-policy";
import { GalleryError } from "@/lib/galleries";
import { recordEvent } from "@/lib/events";
import { ensureWatermarked } from "@/lib/watermark";
import { verifyAccessToken } from "@/lib/gallery-access";
import type { PhotoVariants } from "@/lib/photos";
import type { Storage } from "@/lib/storage/types";

export const DOWNLOAD_URL_TTL_SECONDS = 60;

/** Sets a set's policy; `null` = inherit from the gallery. */
export async function setSetDownloadPolicy(
  deps: { db: Db; accountId: string },
  setId: string,
  policy: unknown,
) {
  z.uuid().parse(setId);
  const value =
    policy === "inherit" || policy === null
      ? null
      : downloadPolicySchema.parse(policy);
  const row = await tenantDb(deps.db, deps.accountId).sets.update(setId, {
    downloadPolicy: value,
  });
  if (!row) throw new GalleryError("not_found", "Set not found.");
}

export type DownloadResult =
  { ok: true; url: string } | { ok: false; reason: "not_found" | "forbidden" };

type Deps = {
  db: Db;
  storage: Storage;
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
 * Signed download URL for one photo of a public gallery. Applies the same
 * visibility rules as the gallery itself (published, not expired, password)
 * plus the effective download policy; the URL lives for one minute.
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
  if (!row) return { ok: false, reason: "not_found" };

  if (
    !allows(effectivePolicy(gallery.downloadPolicy, row.setPolicy), input.size)
  ) {
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
    .from(media)
    .where(
      and(
        eq(media.accountId, gallery.accountId),
        eq(media.setId, row.media.setId),
      ),
    )
    .orderBy(asc(media.position), asc(media.createdAt));
  const n = siblings.findIndex((m) => m.id === row.media.id) + 1;
  const suffix = input.size === "original" ? "-original" : "";
  const url = await deps.storage.signGet(key, DOWNLOAD_URL_TTL_SECONDS, {
    downloadName: `${gallery.slug}-${n}${suffix}${ext}`,
  });
  await recordEvent(deps.db, gallery, "download", row.media.id);
  return { ok: true, url };
}
