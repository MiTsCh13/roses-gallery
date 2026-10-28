import { and, eq, lt } from "drizzle-orm";

import type { Db } from "@/db";
import { media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { processPhoto } from "@/lib/photos";
import type { Storage } from "@/lib/storage/types";

export const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

type Deps = { db: Db; storage: Storage };

/**
 * Housekeeping for photos that stay `pending` for too long. Maintenance runs
 * across accounts, but every row is handled through its own tenant scope.
 *
 * - Original never arrived (abandoned upload): the row is removed. Nothing was
 *   booked yet, so no bytes need to be released. Dangling multipart parts are
 *   left to the bucket's lifecycle rule for incomplete uploads.
 * - Original exists but processing never ran (lost job): processing is retried;
 *   it is idempotent.
 */
export async function cleanupStaleUploads(
  { db, storage }: Deps,
  now: Date = new Date(),
) {
  const cutoff = new Date(now.getTime() - STALE_UPLOAD_MS);
  const stale = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.type, "photo"),
        eq(media.processingStatus, "pending"),
        lt(media.createdAt, cutoff),
      ),
    );

  let removed = 0;
  let retried = 0;
  for (const row of stale) {
    const stored = row.originalKey ? await storage.head(row.originalKey) : null;
    if (!stored) {
      if (row.revision === 1) {
        await tenantDb(db, row.accountId).media.remove(row.id);
        removed++;
      }
      continue;
    }
    await processPhoto(
      { db, storage },
      { accountId: row.accountId, mediaId: row.id },
    ).catch(() => undefined); // marked `failed` by processPhoto
    retried++;
  }
  return { removed, retried };
}
