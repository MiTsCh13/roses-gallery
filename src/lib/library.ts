// Media library (D-142): folders and the assignment of media to galleries.
// Every statement is restricted to one account.
import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { galleries, galleryMedia, media } from "@/db/schema";
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
