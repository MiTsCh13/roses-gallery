import { and, eq, max, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { accounts, media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { assertCanUpload, type SubscriptionStatus } from "@/lib/plans";
import {
  MAX_PHOTO_BYTES,
  PART_SIZE,
  PHOTO_CONTENT_TYPES,
} from "@/lib/upload-limits";
import { originalKey, type Storage } from "@/lib/storage/types";

export { MAX_PHOTO_BYTES, PART_SIZE, PHOTO_CONTENT_TYPES };
export const SIGN_TTL_SECONDS = 15 * 60;

export class UploadError extends Error {
  constructor(
    readonly code: "not_found" | "invalid_state" | "size_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export const startUploadSchema = z.object({
  folderId: z.uuid().optional(),
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
});

export const signPartSchema = z.object({
  mediaId: z.uuid(),
  uploadId: z.string().min(1).max(1024),
  partNumber: z.number().int().min(1).max(10_000),
});

export const completeUploadSchema = z.object({
  mediaId: z.uuid(),
  uploadId: z.string().min(1).max(1024),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10_000),
        etag: z.string().min(1).max(256),
      }),
    )
    .min(1)
    .max(10_000),
});

export const abortUploadSchema = z.object({
  mediaId: z.uuid(),
  uploadId: z.string().min(1).max(1024),
});

type Deps = { db: Db; storage: Storage; accountId: string };

async function loadAccount({ db, accountId }: Deps) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) throw new UploadError("not_found", "Account not found.");
  return {
    ...account,
    subscriptionStatus: account.subscriptionStatus as SubscriptionStatus,
  };
}

/** A media row that is still waiting for its original (own account only). */
async function pendingPhoto(deps: Deps, mediaId: string) {
  const row = await tenantDb(deps.db, deps.accountId).media.get(mediaId);
  if (!row) throw new UploadError("not_found", "Media not found.");
  if (
    row.type !== "photo" ||
    row.processingStatus !== "pending" ||
    !row.originalKey
  ) {
    throw new UploadError("invalid_state", "Upload is not in progress.");
  }
  return { ...row, originalKey: row.originalKey };
}

export async function startUpload(deps: Deps, input: unknown) {
  const data = startUploadSchema.parse(input);
  const account = await loadAccount(deps);
  assertCanUpload(account, data.sizeBytes);

  const t = tenantDb(deps.db, deps.accountId);
  if (data.folderId && !(await t.folders.get(data.folderId))) {
    throw new UploadError("not_found", "Folder not found.");
  }

  const [{ top }] = await deps.db
    .select({ top: max(media.position) })
    .from(media)
    .where(eq(media.accountId, deps.accountId));

  const row = await t.media.create({
    folderId: data.folderId ?? null,
    type: "photo",
    sizeBytes: data.sizeBytes,
    position: (top ?? -1) + 1,
    revision: 1,
    processingStatus: "pending",
  });
  const key = originalKey(deps.accountId, row.id, row.revision);
  await t.media.update(row.id, { originalKey: key });

  const uploadId = await deps.storage.createMultipartUpload(
    key,
    data.contentType,
  );
  return {
    mediaId: row.id,
    uploadId,
    partSize: PART_SIZE,
    partCount: Math.ceil(data.sizeBytes / PART_SIZE),
  };
}

export async function signUploadPart(deps: Deps, input: unknown) {
  const data = signPartSchema.parse(input);
  const row = await pendingPhoto(deps, data.mediaId);
  const url = await deps.storage.signUploadPart(
    row.originalKey,
    data.uploadId,
    data.partNumber,
    SIGN_TTL_SECONDS,
  );
  return { url };
}

/**
 * Finishes the multipart upload, books the real size against the quota check
 * and hands the media to `onUploaded` (enqueues processing).
 */
export async function completeUpload(
  deps: Deps,
  input: unknown,
  onUploaded: (media: { id: string; revision: number }) => Promise<void>,
) {
  const data = completeUploadSchema.parse(input);
  const row = await pendingPhoto(deps, data.mediaId);
  await deps.storage.completeMultipartUpload(
    row.originalKey,
    data.uploadId,
    data.parts,
  );
  const head = await deps.storage.head(row.originalKey);
  if (!head) throw new UploadError("size_mismatch", "Upload is missing.");

  const account = await loadAccount(deps);
  try {
    // The declared size was only a promise; check the real one.
    assertCanUpload(account, head.size);
    if (head.size > MAX_PHOTO_BYTES) {
      throw new UploadError("size_mismatch", "Upload is too large.");
    }
  } catch (error) {
    await deps.storage.delete(row.originalKey);
    await tenantDb(deps.db, deps.accountId).media.remove(row.id);
    throw error;
  }

  await tenantDb(deps.db, deps.accountId).media.update(row.id, {
    sizeBytes: head.size,
  });
  await onUploaded({ id: row.id, revision: row.revision });
  return { mediaId: row.id };
}

export async function abortUpload(deps: Deps, input: unknown) {
  const data = abortUploadSchema.parse(input);
  const row = await pendingPhoto(deps, data.mediaId);
  await deps.storage.abortMultipartUpload(row.originalKey, data.uploadId);
  await tenantDb(deps.db, deps.accountId).media.remove(row.id);
}

// --- Replacing a file (revision) -------------------------------------------
// The live revision stays untouched until the new original is complete, so
// ID, position and favorites survive and the gallery never shows a gap.

export const startReplacementSchema = z.object({
  mediaId: z.uuid(),
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
});

/** A photo that is allowed to receive a new revision (own account only). */
async function replaceablePhoto(deps: Deps, mediaId: string) {
  const row = await tenantDb(deps.db, deps.accountId).media.get(mediaId);
  if (!row) throw new UploadError("not_found", "Media not found.");
  if (
    row.type !== "photo" ||
    !["ready", "failed"].includes(row.processingStatus)
  ) {
    throw new UploadError("invalid_state", "Media cannot be replaced now.");
  }
  return {
    ...row,
    nextKey: originalKey(deps.accountId, row.id, row.revision + 1),
  };
}

export async function startReplacement(deps: Deps, input: unknown) {
  const data = startReplacementSchema.parse(input);
  const row = await replaceablePhoto(deps, data.mediaId);
  const account = await loadAccount(deps);
  // The old revision is released on completion, so only the growth counts.
  assertCanUpload(account, Math.max(0, data.sizeBytes - row.sizeBytes));

  const uploadId = await deps.storage.createMultipartUpload(
    row.nextKey,
    data.contentType,
  );
  return {
    mediaId: row.id,
    uploadId,
    partSize: PART_SIZE,
    partCount: Math.ceil(data.sizeBytes / PART_SIZE),
  };
}

export async function signReplacementPart(deps: Deps, input: unknown) {
  const data = signPartSchema.parse(input);
  const row = await replaceablePhoto(deps, data.mediaId);
  const url = await deps.storage.signUploadPart(
    row.nextKey,
    data.uploadId,
    data.partNumber,
    SIGN_TTL_SECONDS,
  );
  return { url };
}

export async function abortReplacement(deps: Deps, input: unknown) {
  const data = abortUploadSchema.parse(input);
  const row = await replaceablePhoto(deps, data.mediaId);
  await deps.storage.abortMultipartUpload(row.nextKey, data.uploadId);
}

export async function completeReplacement(
  deps: Deps,
  input: unknown,
  onUploaded: (media: { id: string; revision: number }) => Promise<void>,
) {
  const data = completeUploadSchema.parse(input);
  const row = await replaceablePhoto(deps, data.mediaId);
  await deps.storage.completeMultipartUpload(
    row.nextKey,
    data.uploadId,
    data.parts,
  );
  const head = await deps.storage.head(row.nextKey);
  if (!head) throw new UploadError("size_mismatch", "Upload is missing.");

  const oldVariants = Object.values(
    row.variants as Record<string, { key: string; size: number }>,
  );
  // Bytes booked for the old revision (original + variants); 0 if it never
  // finished processing.
  const oldBooked =
    row.processingStatus === "ready"
      ? row.sizeBytes + oldVariants.reduce((n, v) => n + v.size, 0)
      : 0;
  const account = await loadAccount(deps);
  try {
    assertCanUpload(
      { ...account, storageUsedBytes: account.storageUsedBytes - oldBooked },
      head.size,
    );
    if (head.size > MAX_PHOTO_BYTES) {
      throw new UploadError("size_mismatch", "Upload is too large.");
    }
  } catch (error) {
    await deps.storage.delete(row.nextKey);
    throw error;
  }

  const revision = row.revision + 1;
  const switched = await deps.db.transaction(async (tx) => {
    const updated = await tx
      .update(media)
      .set({
        revision,
        originalKey: row.nextKey,
        sizeBytes: head.size,
        variants: {},
        width: null,
        height: null,
        takenAt: null,
        processingStatus: "pending",
      })
      .where(
        and(
          eq(media.id, row.id),
          eq(media.accountId, deps.accountId),
          eq(media.revision, row.revision),
        ),
      )
      .returning({ id: media.id });
    if (updated.length === 0) return false;
    await tx
      .update(accounts)
      .set({
        storageUsedBytes: sql`greatest(0, ${accounts.storageUsedBytes} - ${oldBooked})`,
      })
      .where(eq(accounts.id, deps.accountId));
    return true;
  });
  if (!switched) {
    await deps.storage.delete(row.nextKey);
    throw new UploadError("invalid_state", "Media was changed meanwhile.");
  }

  // Old files are no longer referenced; removal is idempotent.
  if (row.originalKey) await deps.storage.delete(row.originalKey);
  for (const variant of oldVariants) await deps.storage.delete(variant.key);

  await onUploaded({ id: row.id, revision });
  return { mediaId: row.id, revision };
}
