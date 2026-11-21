import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, media, users, visitors } from "@/db/schema";
import { FakeMailer } from "@/lib/mailer";
import { createTestDb, resetDb, linkAccountMedia } from "@/test/db";
import {
  createGuest,
  createList,
  createVisitorToken,
  deleteList,
  FavoritesError,
  loadFavoriteState,
  MAX_LISTS,
  parseVisitorToken,
  requestMagicLink,
  resolveVisitor,
  sendListToCreator,
  toggleFavorite,
} from "./favorites";

const { db, close } = createTestDb();
const SECRET = "test-secret-with-enough-length";
let accountId: string;
let gallery: typeof galleries.$inferSelect;
let photoIds: string[];

async function makeGallery(acc: string, slug: string) {
  const [g] = await db
    .insert(galleries)
    .values({ accountId: acc, slug, title: "Anna & Ben", status: "published" })
    .returning();
  const ids: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const [m] = await db
      .insert(media)
      .values({
        accountId: acc,
        type: "photo",
        processingStatus: "ready",
        position: i,
      })
      .returning();
    ids.push(m.id);
  }
  await linkAccountMedia(db, g.id);
  return { g, ids };
}

beforeEach(async () => {
  await resetDb(db);
  const [a] = await db.insert(accounts).values({ name: "A" }).returning();
  accountId = a.id;
  await db
    .insert(users)
    .values({ accountId, email: "foto@example.com", role: "owner" });
  const made = await makeGallery(accountId, "anna-ben");
  gallery = made.g;
  photoIds = made.ids;
});
afterAll(close);

describe("visitor tokens", () => {
  it("round-trip, and reject tampering and other galleries", async () => {
    const v = await createGuest({ db }, gallery);
    const token = createVisitorToken(SECRET, gallery, v.id);
    expect(parseVisitorToken(SECRET, gallery, token)).toBe(v.id);
    expect(parseVisitorToken("other-secret-other-secret", gallery, token)).toBe(
      null,
    );
    expect(parseVisitorToken(SECRET, { id: crypto.randomUUID() }, token)).toBe(
      null,
    );
    expect(parseVisitorToken(SECRET, gallery, `${v.id}.x`)).toBe(null);
    expect(parseVisitorToken(SECRET, gallery, undefined)).toBe(null);
    expect(
      (await resolveVisitor({ db, secret: SECRET }, gallery, token))?.id,
    ).toBe(v.id);
  });
});

describe("lists and favorites", () => {
  it("toggles photos on and off and reports the state", async () => {
    const v = await createGuest({ db }, gallery);
    const list = await createList({ db }, gallery, v.id, "  Album  ");
    expect(
      await toggleFavorite({ db }, gallery, v.id, {
        listId: list.id,
        mediaId: photoIds[0],
      }),
    ).toEqual({ favorite: true });
    await toggleFavorite({ db }, gallery, v.id, {
      listId: list.id,
      mediaId: photoIds[1],
    });
    let state = await loadFavoriteState({ db }, gallery, v.id);
    expect(state.lists).toEqual([
      { id: list.id, name: "Album", mediaIds: [photoIds[0], photoIds[1]] },
    ]);
    expect(
      await toggleFavorite({ db }, gallery, v.id, {
        listId: list.id,
        mediaId: photoIds[0],
      }),
    ).toEqual({ favorite: false });
    state = await loadFavoriteState({ db }, gallery, v.id);
    expect(state.lists[0].mediaIds).toEqual([photoIds[1]]);
  });

  it("keeps several lists per visitor and deletes them with their favorites", async () => {
    const v = await createGuest({ db }, gallery);
    const a = await createList({ db }, gallery, v.id, "Album");
    const b = await createList({ db }, gallery, v.id, "Wand");
    await toggleFavorite({ db }, gallery, v.id, {
      listId: a.id,
      mediaId: photoIds[0],
    });
    await toggleFavorite({ db }, gallery, v.id, {
      listId: b.id,
      mediaId: photoIds[0],
    });
    await deleteList({ db }, gallery, v.id, a.id);
    const state = await loadFavoriteState({ db }, gallery, v.id);
    expect(state.lists.map((l) => l.name)).toEqual(["Wand"]);
    expect(state.lists[0].mediaIds).toEqual([photoIds[0]]);
  });

  it("validates names and caps the number of lists", async () => {
    const v = await createGuest({ db }, gallery);
    await expect(createList({ db }, gallery, v.id, "  ")).rejects.toMatchObject(
      {
        code: "invalid",
      },
    );
    for (let i = 0; i < MAX_LISTS; i++)
      await createList({ db }, gallery, v.id, `L${i}`);
    await expect(createList({ db }, gallery, v.id, "x")).rejects.toMatchObject({
      code: "limit",
    });
  });

  it("separates visitors and tenants", async () => {
    const a = await createGuest({ db }, gallery);
    const b = await createGuest({ db }, gallery);
    const list = await createList({ db }, gallery, a.id, "Album");
    // another visitor cannot touch the list
    await expect(
      toggleFavorite({ db }, gallery, b.id, {
        listId: list.id,
        mediaId: photoIds[0],
      }),
    ).rejects.toBeInstanceOf(FavoritesError);
    await expect(
      deleteList({ db }, gallery, b.id, list.id),
    ).rejects.toBeInstanceOf(FavoritesError);
    // photos of another gallery/account cannot be favorited
    const [other] = await db.insert(accounts).values({ name: "B" }).returning();
    const foreign = await makeGallery(other.id, "fremd");
    await expect(
      toggleFavorite({ db }, gallery, a.id, {
        listId: list.id,
        mediaId: foreign.ids[0],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    // a visitor of another gallery yields an empty state
    const fv = await createGuest({ db }, foreign.g);
    expect((await loadFavoriteState({ db }, gallery, fv.id)).lists).toEqual([]);
    expect(await loadFavoriteState({ db }, gallery, null)).toEqual({
      lists: [],
      hasEmail: false,
    });
  });
});

describe("magic link", () => {
  const deps = () => ({
    db,
    mailer: new FakeMailer(),
    baseUrl: "https://roses.test",
    secret: SECRET,
  });

  it("attaches the e-mail and mails a working link", async () => {
    const v = await createGuest({ db }, gallery);
    const d = deps();
    await requestMagicLink(d, gallery, v.id, "Paar@Example.com");
    const mail = d.mailer.lastTo("paar@example.com");
    const token = mail!.text.match(/\/v\/(\S+)/)![1];
    expect(parseVisitorToken(SECRET, gallery, token)).toBe(v.id);
    const [row] = await db.select().from(visitors);
    expect(row).toMatchObject({ email: "paar@example.com", role: "client" });
    expect((await loadFavoriteState({ db }, gallery, v.id)).hasEmail).toBe(
      true,
    );
  });

  it("sends the existing visitor's link when the e-mail is known", async () => {
    const first = await createGuest({ db }, gallery);
    const second = await createGuest({ db }, gallery);
    const d = deps();
    await requestMagicLink(d, gallery, first.id, "paar@example.com");
    await requestMagicLink(d, gallery, second.id, "paar@example.com");
    const token = d.mailer
      .lastTo("paar@example.com")!
      .text.match(/\/v\/(\S+)/)![1];
    expect(parseVisitorToken(SECRET, gallery, token)).toBe(first.id);
  });

  it("rejects invalid addresses", async () => {
    const v = await createGuest({ db }, gallery);
    await expect(
      requestMagicLink(deps(), gallery, v.id, "kein-mail"),
    ).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("export to the creator", () => {
  it("mails the list with photo numbers to the owners", async () => {
    const v = await createGuest({ db }, gallery);
    const list = await createList({ db }, gallery, v.id, "Album");
    const mailer = new FakeMailer();
    const deps = { db, mailer, baseUrl: "https://roses.test" };
    await expect(
      sendListToCreator(deps, gallery, v.id, list.id),
    ).rejects.toMatchObject({ code: "empty" });
    for (const id of [photoIds[2], photoIds[0]])
      await toggleFavorite({ db }, gallery, v.id, {
        listId: list.id,
        mediaId: id,
      });
    expect(await sendListToCreator(deps, gallery, v.id, list.id)).toEqual({
      count: 2,
    });
    const mail = mailer.lastTo("foto@example.com")!;
    expect(mail.subject).toContain("Album");
    expect(mail.text).toContain("Fotos: 1, 3");
    expect(mail.text).toContain("https://roses.test/g/anna-ben");
  });

  it("accepts videos as favorites and lists them separately", async () => {
    const [video] = await db
      .insert(media)
      .values({
        accountId,
        type: "video",
        processingStatus: "ready",
        position: 9,
      })
      .returning();
    await linkAccountMedia(db, gallery.id);
    const v = await createGuest({ db }, gallery);
    const list = await createList({ db }, gallery, v.id, "Album");
    expect(
      await toggleFavorite({ db }, gallery, v.id, {
        listId: list.id,
        mediaId: video.id,
      }),
    ).toEqual({ favorite: true });
    await toggleFavorite({ db }, gallery, v.id, {
      listId: list.id,
      mediaId: photoIds[1],
    });
    const mailer = new FakeMailer();
    await sendListToCreator(
      { db, mailer, baseUrl: "https://roses.test" },
      gallery,
      v.id,
      list.id,
    );
    const text = mailer.lastTo("foto@example.com")!.text;
    expect(text).toContain("Fotos: 2");
    expect(text).toContain("Videos: 1");
  });
});
