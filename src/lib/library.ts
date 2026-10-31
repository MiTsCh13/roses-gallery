// Media library (D-142): folders and the assignment of media to galleries.
// Every statement is restricted to one account.
import { and, asc, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { accounts, folders, galleries, galleryMedia, media } from "@/db/schema";
import type { Storage } from "@/lib/storage/types";
import type { VideoProvider } from "@/lib/video/types";
import { tenantDb } from "@/db/tenant";

type Deps = { db: Db; accountId: string };

export class LibraryError extends Error {
  constructor(
    readonly code: "not_found" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "LibraryError";
  }
}

export const folderNameSchema = z.string().trim().min(1).max(120);

/** Appends a medium to a gallery; no-op when it is already assigned. */
export async function addToGallery(
  deps: Deps,
  galleryId: string,
  mediaId: string,
) {
  const t = tenantDb(deps.db, deps.accountId);
  const [gallery, item] = await Promise.all([
    t.galleries.get(galleryId),
    t.media.get(mediaId),
  ]);
  if (!gallery || !item) throw new LibraryError("not_found", "Not found.");

  const [{ top }] = await deps.db
    .select({ top: max(galleryMedia.position) })
    .from(galleryMedia)
    .where(
      and(
        eq(galleryMedia.accountId, deps.accountId),
        eq(galleryMedia.galleryId, galleryId),
      ),
    );
  await deps.db
    .insert(galleryMedia)
    .values({
      accountId: deps.accountId,
      galleryId,
      mediaId,
      position: (top ?? -1) + 1,
    })
    .onConflictDoNothing();
}

/** Removes the assignment only; the medium stays in the library. */
export async function removeFromGallery(
  deps: Deps,
  galleryId: string,
  mediaId: string,
) {
  await deps.db
    .delete(galleryMedia)
    .where(
      and(
        eq(galleryMedia.accountId, deps.accountId),
        eq(galleryMedia.galleryId, galleryId),
        eq(galleryMedia.mediaId, mediaId),
      ),
    );
}

/** Media of a gallery in display order (own account only). */
export async function listGalleryMedia(deps: Deps, galleryId: string) {
  const rows = await deps.db
    .select({ media })
    .from(galleryMedia)
    .innerJoin(media, eq(media.id, galleryMedia.mediaId))
    .innerJoin(galleries, eq(galleries.id, galleryMedia.galleryId))
    .where(
      and(
        eq(galleryMedia.accountId, deps.accountId),
        eq(media.accountId, deps.accountId),
        eq(galleries.accountId, deps.accountId),
        eq(galleryMedia.galleryId, galleryId),
      ),
    )
    .orderBy(asc(galleryMedia.position), asc(media.createdAt));
  return rows.map((r) => r.media);
}

export async function createFolder(
  deps: Deps,
  input: { name: string; parentId?: string | null },
) {
  const name = folderNameSchema.parse(input.name);
  const t = tenantDb(deps.db, deps.accountId);
  if (input.parentId && !(await t.folders.get(input.parentId))) {
    throw new LibraryError("not_found", "Parent folder not found.");
  }
  return t.folders.create({ name, parentId: input.parentId ?? null });
}

export async function renameFolder(deps: Deps, id: string, name: string) {
  const row = await tenantDb(deps.db, deps.accountId).folders.update(id, {
    name: folderNameSchema.parse(name),
  });
  if (!row) throw new LibraryError("not_found", "Folder not found.");
  return row;
}

/** Moves media into a folder (null = library root). */
export async function moveMedia(
  deps: Deps,
  mediaIds: string[],
  folderId: string | null,
) {
  const t = tenantDb(deps.db, deps.accountId);
  if (folderId && !(await t.folders.get(folderId))) {
    throw new LibraryError("not_found", "Folder not found.");
  }
  for (const id of mediaIds) await t.media.update(id, { folderId });
}

/** Subfolders and media of one folder (null = root), newest media first. */
export async function listFolder(deps: Deps, folderId: string | null) {
  const own = eq(folders.accountId, deps.accountId);
  const [subfolders, items, current] = await Promise.all([
    deps.db
      .select()
      .from(folders)
      .where(
        and(
          own,
          folderId ? eq(folders.parentId, folderId) : isNull(folders.parentId),
        ),
      )
      .orderBy(asc(folders.name)),
    deps.db
      .select()
      .from(media)
      .where(
        and(
          eq(media.accountId, deps.accountId),
          folderId ? eq(media.folderId, folderId) : isNull(media.folderId),
        ),
      )
      .orderBy(desc(media.createdAt)),
    folderId
      ? tenantDb(deps.db, deps.accountId).folders.get(folderId)
      : Promise.resolve(undefined),
  ]);
  if (folderId && !current) throw new LibraryError("not_found", "Not found.");
  return { folder: current ?? null, folders: subfolders, media: items };
}

/** Path from the root to the folder (own account only). */
export async function folderPath(deps: Deps, folderId: string) {
  const t = tenantDb(deps.db, deps.accountId);
  const path: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (
    let cur = await t.folders.get(folderId);
    cur && !seen.has(cur.id);
    cur = cur.parentId ? await t.folders.get(cur.parentId) : undefined
  ) {
    seen.add(cur.id);
    path.unshift({ id: cur.id, name: cur.name });
  }
  return path;
}

/** Deletes the folder and its subfolders; media move to the library root. */
export async function deleteFolder(deps: Deps, id: string) {
  const t = tenantDb(deps.db, deps.accountId);
  if (!(await t.folders.get(id)))
    throw new LibraryError("not_found", "Folder not found.");
  // Collect the subtree first: the FK only nulls media.folderId for rows whose
  // folder is deleted, which is exactly the wanted behavior (back to root).
  await t.folders.remove(id);
}

type DeleteDeps = Deps & { storage: Storage; video: VideoProvider };

/**
 * Deletes media from the library for good: files, gallery assignments (cascade)
 * and the booked storage. Ids of other accounts are ignored.
 */
export async function deleteMedia(deps: DeleteDeps, mediaIds: string[]) {
  if (!mediaIds.length) return 0;
  const rows = await deps.db
    .select()
    .from(media)
    .where(
      and(eq(media.accountId, deps.accountId), inArray(media.id, mediaIds)),
    );
  for (const row of rows) {
    if (row.type === "video") {
      if (row.bunnyVideoId) await deps.video.deleteVideo(row.bunnyVideoId);
    } else {
      if (row.originalKey) await deps.storage.delete(row.originalKey);
      for (const v of Object.values(row.variants) as { key?: string }[]) {
        if (v?.key) await deps.storage.delete(v.key);
      }
    }
    const derived =
      row.type === "photo"
        ? (Object.values(row.variants) as { size?: number }[]).reduce(
            (sum, v) => sum + (v?.size ?? 0),
            0,
          )
        : 0;
    await deps.db.transaction(async (tx) => {
      await tx
        .delete(media)
        .where(and(eq(media.id, row.id), eq(media.accountId, deps.accountId)));
      if (row.processingStatus === "ready") {
        await tx
          .update(accounts)
          .set({
            storageUsedBytes: sql`greatest(${accounts.storageUsedBytes} - ${row.sizeBytes + derived}, 0)`,
          })
          .where(eq(accounts.id, deps.accountId));
      }
    });
  }
  return rows.length;
}

/** Library media not yet in the gallery, newest first (own account only). */
export async function listAddableMedia(
  deps: Deps,
  galleryId: string,
  limit = 200,
) {
  const assigned = deps.db
    .select({ id: galleryMedia.mediaId })
    .from(galleryMedia)
    .where(
      and(
        eq(galleryMedia.accountId, deps.accountId),
        eq(galleryMedia.galleryId, galleryId),
      ),
    );
  return deps.db
    .select()
    .from(media)
    .where(
      and(
        eq(media.accountId, deps.accountId),
        eq(media.processingStatus, "ready"),
        sql`${media.id} not in ${assigned}`,
      ),
    )
    .orderBy(desc(media.createdAt))
    .limit(limit);
}
