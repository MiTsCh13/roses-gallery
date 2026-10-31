import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, media, sets } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import {
  addToGallery,
  createFolder,
  LibraryError,
  listGalleryMedia,
  moveMedia,
  removeFromGallery,
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

describe("migration 0014 data takeover", () => {
  it("is covered by the SQL window function: set order, then media order", async () => {
    // Re-run the backfill statement against fresh data.
    const [s1, s2] = await db
      .insert(sets)
      .values([
        {
          accountId: a.accountId,
          galleryId: galleryA,
          title: "S1",
          position: 1,
        },
        {
          accountId: a.accountId,
          galleryId: galleryA,
          title: "S2",
          position: 0,
        },
      ])
      .returning();
    const [m1, m2, m3] = await db
      .insert(media)
      .values([
        { accountId: a.accountId, setId: s1.id, type: "photo", position: 0 },
        { accountId: a.accountId, setId: s1.id, type: "photo", position: 1 },
        { accountId: a.accountId, setId: s2.id, type: "photo", position: 0 },
      ])
      .returning();
    const fs = await import("node:fs");
    const sql = fs.readFileSync(
      "drizzle/0014_breezy_living_tribunal.sql",
      "utf8",
    );
    const insert = sql.slice(sql.indexOf("INSERT INTO"));
    await db.execute(insert as unknown as import("drizzle-orm").SQL);
    const list = await listGalleryMedia(a, galleryA);
    expect(list.map((m) => m.id)).toEqual([m3.id, m1.id, m2.id]);
  });
});
