import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, galleryMedia, media } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { createGuest, createList, toggleFavorite } from "./favorites";
import { favoritesCsv, galleryFavorites } from "./favorites-overview";

const { db, close } = createTestDb();
let accountId: string;
let gallery: typeof galleries.$inferSelect;
let ids: { p1: string; p2: string; v1: string; p3: string };

async function addMedia(
  acc: string,
  galleryId: string,
  type: "photo" | "video",
  position: number,
) {
  const [m] = await db
    .insert(media)
    .values({ accountId: acc, type, processingStatus: "ready" })
    .returning();
  await db
    .insert(galleryMedia)
    .values({ accountId: acc, galleryId, mediaId: m.id, position });
  return m.id;
}

beforeEach(async () => {
  await resetDb(db);
  const [a] = await db.insert(accounts).values({ name: "A" }).returning();
  accountId = a.id;
  [gallery] = await db
    .insert(galleries)
    .values({ accountId, slug: "anna", title: "Anna", status: "published" })
    .returning();
  ids = {
    p1: await addMedia(accountId, gallery.id, "photo", 1),
    v1: await addMedia(accountId, gallery.id, "video", 2),
    p2: await addMedia(accountId, gallery.id, "photo", 3),
    p3: await addMedia(accountId, gallery.id, "photo", 4),
  };
});
afterAll(close);

async function fav(visitorId: string, listId: string, mediaId: string) {
  await toggleFavorite({ db }, gallery, visitorId, { listId, mediaId });
}

describe("galleryFavorites", () => {
  it("lists non-empty lists with visitor numbers, photos and videos apart", async () => {
    const guest = await createGuest({ db }, gallery);
    const album = await createList({ db }, gallery, guest.id, "Album");
    await createList({ db }, gallery, guest.id, "Leer");
    await fav(guest.id, album.id, ids.p3);
    await fav(guest.id, album.id, ids.v1);
    await fav(guest.id, album.id, ids.p1);

    const lists = await galleryFavorites({ db, accountId }, gallery.id);
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({
      name: "Album",
      email: null,
      photos: [1, 3],
      videos: [1],
    });
  });

  it("is scoped to the account and the gallery", async () => {
    const guest = await createGuest({ db }, gallery);
    const list = await createList({ db }, gallery, guest.id, "Album");
    await fav(guest.id, list.id, ids.p2);

    const [other] = await db.insert(accounts).values({ name: "B" }).returning();
    expect(
      await galleryFavorites({ db, accountId: other.id }, gallery.id),
    ).toEqual([]);
    const [second] = await db
      .insert(galleries)
      .values({ accountId, slug: "zwei", title: "Zwei" })
      .returning();
    expect(await galleryFavorites({ db, accountId }, second.id)).toEqual([]);
    expect(
      (await galleryFavorites({ db, accountId }, gallery.id))[0].photos,
    ).toEqual([2]);
  });
});

describe("favoritesCsv", () => {
  const labels = {
    list: "Liste",
    visitor: "Besucher",
    type: "Typ",
    number: "Nummer",
    photo: "Foto",
    video: "Video",
    guest: "Gast",
  };

  it("writes one quoted row per favorite with a BOM", () => {
    const csv = favoritesCsv(
      [
        {
          id: "x",
          name: 'Album "A"',
          email: "anna@example.com",
          createdAt: new Date(),
          photos: [1, 3],
          videos: [2],
        },
      ],
      labels,
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      '"Liste";"Besucher";"Typ";"Nummer"',
      '"Album ""A""";"anna@example.com";"Foto";"1"',
      '"Album ""A""";"anna@example.com";"Foto";"3"',
      '"Album ""A""";"anna@example.com";"Video";"2"',
      "",
    ]);
  });

  it("neutralises formulas in visitor-chosen names", () => {
    const csv = favoritesCsv(
      [
        {
          id: "x",
          name: "=HYPERLINK(1)",
          email: null,
          createdAt: new Date(),
          photos: [1],
          videos: [],
        },
      ],
      labels,
    );
    expect(csv).toContain(`"'=HYPERLINK(1)";"Gast";"Foto";"1"`);
  });
});
