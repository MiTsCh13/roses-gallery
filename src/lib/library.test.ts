import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { accounts, folders, galleries, media } from "@/db/schema";
import { FakeStorage } from "@/lib/storage/fake";
import { FakeVideoProvider } from "@/lib/video/fake";
import { createTestDb, resetDb } from "@/test/db";
import {
  addToGallery,
  createFolder,
  deleteFolder,
  deleteMedia,
  folderPath,
  listFolder,
  LibraryError,
  listAddableMedia,
  listGalleryMedia,
  moveMedia,
  removeFromGallery,
  reorderGalleryMedia,
  renameFolder,
} from "./library";

const { db, close } = createTestDb();
let a: { db: typeof db; accountId: string };
let b: { db: typeof db; accountId: string };
let galleryA: string;

async function newMedia(accountId: string) {
  const [m] = await db
    .insert(media)
    .values({ accountId, type: "photo" })
    .returning();
  return m.id;
}

beforeEach(async () => {
  await resetDb(db);
  const [x, y] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  a = { db, accountId: x.id };
  b = { db, accountId: y.id };
  const [g] = await db
    .insert(galleries)
    .values({ accountId: x.id, title: "G", slug: "g-a" })
    .returning();
  galleryA = g.id;
});
afterAll(() => close());

describe("library", () => {
  it("allows media without a set and lists them in gallery order", async () => {
    const m1 = await newMedia(a.accountId);
    const m2 = await newMedia(a.accountId);
    await addToGallery(a, galleryA, m2);
    await addToGallery(a, galleryA, m1);
    await addToGallery(a, galleryA, m2); // idempotent
    const list = await listGalleryMedia(a, galleryA);
    expect(list.map((m) => m.id)).toEqual([m2, m1]);
  });

  it("removing an assignment keeps the medium", async () => {
    const m = await newMedia(a.accountId);
    await addToGallery(a, galleryA, m);
    await removeFromGallery(a, galleryA, m);
    expect(await listGalleryMedia(a, galleryA)).toEqual([]);
    expect(await db.select().from(media)).toHaveLength(1);
  });

  it("reorders gallery media and appends unlisted ones", async () => {
    const [m1, m2, m3] = [
      await newMedia(a.accountId),
      await newMedia(a.accountId),
      await newMedia(a.accountId),
    ];
    for (const m of [m1, m2, m3]) await addToGallery(a, galleryA, m);
    await reorderGalleryMedia(a, galleryA, [m3, m1]);
    const ids = (await listGalleryMedia(a, galleryA)).map((m) => m.id);
    expect(ids).toEqual([m3, m1, m2]);
  });

  it("reordering does not cross accounts", async () => {
    const m = await newMedia(a.accountId);
    await addToGallery(a, galleryA, m);
    await expect(reorderGalleryMedia(b, galleryA, [m])).rejects.toBeInstanceOf(
      LibraryError,
    );
  });

  it("one medium can sit in several galleries", async () => {
    const [g2] = await db
      .insert(galleries)
      .values({ accountId: a.accountId, title: "G2", slug: "g-a2" })
      .returning();
    const m = await newMedia(a.accountId);
    await addToGallery(a, galleryA, m);
    await addToGallery(a, g2.id, m);
    expect(await listGalleryMedia(a, g2.id)).toHaveLength(1);
  });

  it("does not cross accounts", async () => {
    const mB = await newMedia(b.accountId);
    await expect(addToGallery(b, galleryA, mB)).rejects.toBeInstanceOf(
      LibraryError,
    );
    const mA = await newMedia(a.accountId);
    await expect(addToGallery(b, galleryA, mA)).rejects.toBeInstanceOf(
      LibraryError,
    );
    const f = await createFolder(a, { name: "Trauung" });
    await expect(
      createFolder(b, { name: "x", parentId: f.id }),
    ).rejects.toBeInstanceOf(LibraryError);
    await expect(renameFolder(b, f.id, "y")).rejects.toBeInstanceOf(
      LibraryError,
    );
    await expect(moveMedia(b, [mB], f.id)).rejects.toBeInstanceOf(LibraryError);
  });

  it("nests folders and moves media", async () => {
    const root = await createFolder(a, { name: "  2026  " });
    expect(root.name).toBe("2026");
    const child = await createFolder(a, { name: "Fest", parentId: root.id });
    const m = await newMedia(a.accountId);
    await moveMedia(a, [m], child.id);
    const [row] = await db.select().from(media);
    expect(row.folderId).toBe(child.id);
    await moveMedia(a, [m], null);
    expect((await db.select().from(media))[0].folderId).toBeNull();
    await expect(createFolder(a, { name: " " })).rejects.toThrow();
  });
});

describe("addable media", () => {
  it("lists only own, ready media that are not yet in the gallery", async () => {
    const inside = await newMedia(a.accountId);
    const free = await newMedia(a.accountId);
    const foreign = await newMedia(b.accountId);
    const [pending] = await db
      .insert(media)
      .values({ accountId: a.accountId, type: "photo" })
      .returning();
    await db
      .update(media)
      .set({ processingStatus: "ready" })
      .where(eq(media.accountId, a.accountId));
    await db
      .update(media)
      .set({ processingStatus: "pending" })
      .where(eq(media.id, pending.id));
    await db
      .update(media)
      .set({ processingStatus: "ready" })
      .where(eq(media.id, foreign));
    await addToGallery(a, galleryA, inside);
    const ids = (await listAddableMedia(a, galleryA)).map((m) => m.id);
    expect(ids).toEqual([free]);
  });
});

describe("library browsing and deleting", () => {
  it("lists folder content per level and builds the path", async () => {
    const f1 = await createFolder(a, { name: "Trauung" });
    const f2 = await createFolder(a, { name: "Ringe", parentId: f1.id });
    const m = await newMedia(a.accountId);
    await moveMedia(a, [m], f2.id);
    const root = await listFolder(a, null);
    expect(root.folders.map((f) => f.name)).toEqual(["Trauung"]);
    expect(root.media).toHaveLength(0);
    const inner = await listFolder(a, f2.id);
    expect(inner.media.map((x) => x.id)).toEqual([m]);
    expect((await folderPath(a, f2.id)).map((p) => p.name)).toEqual([
      "Trauung",
      "Ringe",
    ]);
    await expect(listFolder(b, f1.id)).rejects.toBeInstanceOf(LibraryError);
    expect(await folderPath(b, f1.id)).toEqual([]);
  });

  it("deleting a folder removes subfolders and moves media to the root", async () => {
    const f1 = await createFolder(a, { name: "A" });
    const f2 = await createFolder(a, { name: "B", parentId: f1.id });
    const m = await newMedia(a.accountId);
    await moveMedia(a, [m], f2.id);
    await expect(deleteFolder(b, f1.id)).rejects.toBeInstanceOf(LibraryError);
    await deleteFolder(a, f1.id);
    expect(await db.select().from(folders)).toHaveLength(0);
    expect((await listFolder(a, null)).media.map((x) => x.id)).toEqual([m]);
  });

  it("deletes photos and videos, frees storage and ignores foreign ids", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "library-"));
    const storage = new FakeStorage(dir, "secret-secret-secret");
    const video = new FakeVideoProvider();
    await storage.put("x/o", Buffer.from("o"));
    await storage.put("x/v400", Buffer.from("v"));
    await db
      .update(accounts)
      .set({ storageUsedBytes: 1000 })
      .where(eq(accounts.id, a.accountId));
    const [photo] = await db
      .insert(media)
      .values({
        accountId: a.accountId,
        type: "photo",
        originalKey: "x/o",
        sizeBytes: 600,
        processingStatus: "ready",
        variants: { "400": { key: "x/v400", width: 1, height: 1, size: 100 } },
      })
      .returning();
    const foreign = await newMedia(b.accountId);
    const deps = { ...a, storage, video };
    const n = await deleteMedia(deps, [photo.id, foreign]);
    expect(n).toBe(1);
    expect(await storage.head("x/o")).toBeNull();
    expect(await storage.head("x/v400")).toBeNull();
    const [acc] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, a.accountId));
    expect(acc.storageUsedBytes).toBe(300);
    expect(await db.select().from(media)).toHaveLength(1); // foreign stays
    await rm(dir, { recursive: true, force: true });
  });
});
