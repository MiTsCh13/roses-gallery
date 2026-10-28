import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, events, galleries, media, sets } from "@/db/schema";
import { FakeStorage } from "@/lib/storage/fake";
import { createTestDb, resetDb } from "@/test/db";
import { resolvePhotoDownload } from "./downloads";
import { recordEvent, recordPlay, galleryStats } from "./events";
import { createGuest, createList, toggleFavorite } from "./favorites";

const { db, close } = createTestDb();
const storage = new FakeStorage(
  mkdtempSync(path.join(os.tmpdir(), "roses-ev-")),
  "secret",
);
let gallery: typeof galleries.$inferSelect;
let photoId: string;
let videoId: string;

beforeEach(async () => {
  await resetDb(db);
  const [a] = await db.insert(accounts).values({ name: "A" }).returning();
  [gallery] = await db
    .insert(galleries)
    .values({
      accountId: a.id,
      slug: "anna-ben",
      title: "A",
      status: "published",
    })
    .returning();
  const [set] = await db
    .insert(sets)
    .values({ accountId: a.id, galleryId: gallery.id, title: "T" })
    .returning();
  const [p] = await db
    .insert(media)
    .values({
      accountId: a.id,
      setId: set.id,
      type: "photo",
      processingStatus: "ready",
      variants: {
        "2400": { key: `${a.id}/p/r1-2400.webp`, width: 1, height: 1, size: 1 },
      },
    })
    .returning();
  const [v] = await db
    .insert(media)
    .values({
      accountId: a.id,
      setId: set.id,
      type: "video",
      processingStatus: "ready",
    })
    .returning();
  photoId = p.id;
  videoId = v.id;
});
afterAll(close);

describe("events", () => {
  it("stores only what, where and when", async () => {
    await recordEvent(db, gallery, "view");
    const [e] = await db.select().from(events);
    expect(e).toMatchObject({
      accountId: gallery.accountId,
      galleryId: gallery.id,
      type: "view",
      mediaId: null,
      visitorId: null,
    });
  });

  it("counts downloads, favorites and plays of the gallery", async () => {
    await resolvePhotoDownload(
      { db, storage },
      { slug: "anna-ben", mediaId: photoId, size: "web" },
    );
    const guest = await createGuest({ db }, gallery);
    const list = await createList({ db }, gallery, guest.id, "L");
    await toggleFavorite({ db }, gallery, guest.id, {
      listId: list.id,
      mediaId: photoId,
    });
    // removing a favorite is not an event
    await toggleFavorite({ db }, gallery, guest.id, {
      listId: list.id,
      mediaId: photoId,
    });
    expect(await recordPlay(db, gallery, videoId)).toBe(true);
    expect(await recordPlay(db, gallery, photoId)).toBe(false);
    expect(await recordPlay(db, gallery, crypto.randomUUID())).toBe(false);
    expect(await galleryStats(db, gallery.accountId, gallery.id, 7)).toEqual({
      view: 0,
      play: 1,
      download: 1,
      favorite: 1,
    });
  });

  it("does not count refused downloads", async () => {
    await db.update(galleries).set({ downloadPolicy: "none" });
    await resolvePhotoDownload(
      { db, storage },
      { slug: "anna-ben", mediaId: photoId, size: "web" },
    );
    expect((await db.select().from(events)).length).toBe(0);
  });

  it("limits stats to the window and the tenant", async () => {
    const now = new Date("2026-10-28T12:00:00Z");
    const at = (days: number) => new Date(now.getTime() - days * 86_400_000);
    await db.insert(events).values([
      {
        accountId: gallery.accountId,
        galleryId: gallery.id,
        type: "view",
        ts: at(1),
      },
      {
        accountId: gallery.accountId,
        galleryId: gallery.id,
        type: "view",
        ts: at(10),
      },
      {
        accountId: gallery.accountId,
        galleryId: gallery.id,
        type: "view",
        ts: at(40),
      },
    ]);
    expect(
      (await galleryStats(db, gallery.accountId, gallery.id, 7, now)).view,
    ).toBe(1);
    expect(
      (await galleryStats(db, gallery.accountId, gallery.id, 30, now)).view,
    ).toBe(2);
    const [other] = await db.insert(accounts).values({ name: "B" }).returning();
    expect((await galleryStats(db, other.id, gallery.id, 30, now)).view).toBe(
      0,
    );
  });
});
