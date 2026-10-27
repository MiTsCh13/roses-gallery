import { and, eq, inArray, sql } from "drizzle-orm";
import exifr from "exifr";
import sharp from "sharp";

import type { Db } from "@/db";
import { accounts, media } from "@/db/schema";
import { derivativeKey, type Storage } from "@/lib/storage/types";

export const PHOTO_WIDTHS = [400, 1200, 2400] as const;

export type PhotoVariants = Record<
  string,
  { key: string; width: number; height: number; size: number }
>;

type Deps = { db: Db; storage: Storage };

async function readTakenAt(original: Buffer): Promise<Date | null> {
  try {
    const exif = (await exifr.parse(original, ["DateTimeOriginal"])) as {
      DateTimeOriginal?: unknown;
    } | null;
    const value = exif?.DateTimeOriginal;
    return value instanceof Date && !Number.isNaN(value.getTime())
      ? value
      : null;
  } catch {
    return null;
  }
}

/**
 * Creates the WebP variants (400/1200/2400 px, never upscaled), reads the EXIF
 * date and books original + variants against the account's storage. Safe to
 * retry: bytes are only booked on the transition to `ready`.
 */
export async function processPhoto(
  { db, storage }: Deps,
  input: { accountId: string; mediaId: string },
) {
  const { accountId, mediaId } = input;
  const [claimed] = await db
    .update(media)
    .set({ processingStatus: "processing" })
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.accountId, accountId),
        eq(media.type, "photo"),
        inArray(media.processingStatus, ["pending", "processing"]),
      ),
    )
    .returning();
  if (!claimed?.originalKey) return { status: "skipped" as const };

  try {
    const original = await storage.get(claimed.originalKey);
    // rotate() applies the EXIF orientation before the metadata is dropped.
    const base = sharp(original, { failOn: "error" }).rotate();
    const meta = await sharp(original).metadata();
    // Orientations 5–8 are rotated by 90°, so the displayed size is swapped.
    const swap = (meta.orientation ?? 1) >= 5;
    const width = (swap ? meta.height : meta.width) ?? 0;
    const height = (swap ? meta.width : meta.height) ?? 0;
    if (!width || !height) throw new Error("Unreadable image dimensions.");

    const variants: PhotoVariants = {};
    let derivedBytes = 0;
    for (const target of PHOTO_WIDTHS) {
      const { data, info } = await base
        .clone()
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      const key = derivativeKey(accountId, mediaId, claimed.revision, target);
      await storage.put(key, data, "image/webp");
      variants[String(target)] = {
        key,
        width: info.width,
        height: info.height,
        size: data.length,
      };
      derivedBytes += data.length;
    }
    const takenAt = await readTakenAt(original);

    await db.transaction(async (tx) => {
      const [done] = await tx
        .update(media)
        .set({
          processingStatus: "ready",
          variants,
          width,
          height,
          takenAt,
        })
        .where(
          and(
            eq(media.id, mediaId),
            eq(media.accountId, accountId),
            eq(media.processingStatus, "processing"),
          ),
        )
        .returning({ id: media.id });
      if (!done) return;
      await tx
        .update(accounts)
        .set({
          storageUsedBytes: sql`${accounts.storageUsedBytes} + ${claimed.sizeBytes + derivedBytes}`,
        })
        .where(eq(accounts.id, accountId));
    });
    return { status: "ready" as const, variants };
  } catch (error) {
    await db
      .update(media)
      .set({ processingStatus: "failed" })
      .where(and(eq(media.id, mediaId), eq(media.accountId, accountId)));
    throw error;
  }
}
