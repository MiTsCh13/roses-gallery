import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { createTestDb, resetDb } from "@/test/db";
import {
  createGallery,
  createSet,
  galleryOverview,
  GalleryError,
  reorderMedia,
  reorderSets,
  setGalleryCover,
  slugify,
  updateGallery,
} from "./galleries";
import { PlanLimitError } from "./plans";

const { db, close } = createTestDb();
let a: { db: typeof db; accountId: string };
let b: { db: typeof db; accountId: string };

beforeEach(async () => {
  await resetDb(db);
  const [x, y] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  a = { db, accountId: x.id };
  b = { db, accountId: y.id };
});
afterAll(() => close());

describe("slugify", () => {
  it("transliterates umlauts and strips punctuation", () => {
    expect(slugify("Hochzeit Anna & Jörg – 2026!")).toBe(
      "hochzeit-anna-joerg-2026",
    );
    expect(slugify("***")).toBe("");
  });
});

describe("createGallery", () => {
  it("creates a draft with a generated unique slug", async () => {
    const g1 = await createGallery(a, { title: "Anna & Ben" });
    const g2 = await createGallery(a, { title: "Anna & Ben" });
    expect(g1.status).toBe("draft");
    expect(g1.slug).toBe("anna-ben");
    expect(g2.slug).toBe("anna-ben-2");
  });

  it("keeps slugs globally unique, also across accounts", async () => {
    await createGallery(a, { title: "X", slug: "hochzeit" });
    await expect(
      createGallery(a, { title: "Y", slug: "hochzeit" }),
    ).rejects.toMatchObject({ code: "slug_taken" });
    await expect(
      createGallery(b, { title: "Y", slug: "hochzeit" }),
    ).rejects.toMatchObject({ code: "slug_taken" });
    const other = await createGallery(b, { title: "Hochzeit" });
    expect(other.slug).toBe("hochzeit-2");
  });

  it("rejects invalid input", async () => {
    await expect(createGallery(a, { title: " " })).rejects.toThrow();
    await expect(
      createGallery(a, { title: "X", slug: "Bad Slug!" }),
    ).rejects.toThrow();
  });

  it("enforces the plan's gallery limit (free: 3)", async () => {
    for (let i = 0; i < 3; i++) await createGallery(a, { title: `G${i}` });
    await expect(createGallery(a, { title: "G4" })).rejects.toBeInstanceOf(
      PlanLimitError,
    );
  });

  it("parses empty dates as null", async () => {
    const g = await createGallery(a, {
      title: "D",
      eventDate: "",
      expiresAt: "2027-01-31",
    });
    expect(g.eventDate).toBeNull();
    expect(g.expiresAt?.toISOString().slice(0, 10)).toBe("2027-01-31");
  });
});

describe("updateGallery", () => {
  it("updates fields and status", async () => {
    const g = await createGallery(a, { title: "Alt" });
    const u = await updateGallery(a, {
      galleryId: g.id,
      title: "Neu",
      slug: "neu",
      status: "published",
      eventDate: "2026-06-01",
      expiresAt: "",
    });
    expect(u).toMatchObject({ title: "Neu", slug: "neu", status: "published" });
  });

  it("cannot touch another account's gallery", async () => {
    const g = await createGallery(a, { title: "Meine" });
    await expect(
      updateGallery(b, { galleryId: g.id, title: "Geklaut", status: "draft" }),
    ).rejects.toBeInstanceOf(GalleryError);
    const [row] = await tenantDb(db, a.accountId).galleries.list();
    expect(row.title).toBe("Meine");
  });

  it("only accepts a cover from the gallery's own media", async () => {
    const g1 = await createGallery(a, { title: "G1" });
    const g2 = await createGallery(a, { title: "G2" });
    const s1 = await createSet(a, {
      galleryId: g1.id,
      title: "S",
      type: "photo",
    });
    const s2 = await createSet(a, {
      galleryId: g2.id,
      title: "S",
      type: "photo",
    });
    const [m1] = await db
      .insert(media)
      .values({ accountId: a.accountId, setId: s1.id, type: "photo" })
      .returning();
    const [m2] = await db
      .insert(media)
      .values({ accountId: a.accountId, setId: s2.id, type: "photo" })
      .returning();
    const base = { galleryId: g1.id, title: "G1", status: "draft" as const };
    await expect(
      updateGallery(a, { ...base, coverMediaId: m2.id }),
    ).rejects.toMatchObject({ code: "not_found" });
    const ok = await updateGallery(a, { ...base, coverMediaId: m1.id });
    expect(ok.coverMediaId).toBe(m1.id);
    const cleared = await updateGallery(a, { ...base, coverMediaId: null });
    expect(cleared.coverMediaId).toBeNull();
  });
});

describe("createSet", () => {
  it("appends with increasing position and supports hybrid galleries", async () => {
    const g = await createGallery(a, { title: "Hybrid" });
    const s1 = await createSet(a, {
      galleryId: g.id,
      title: "Fotos",
      type: "photo",
    });
    const s2 = await createSet(a, {
      galleryId: g.id,
      title: "Film",
      type: "video",
    });
    expect([s1.position, s2.position]).toEqual([0, 1]);
    expect(s2.type).toBe("video");
  });

  it("rejects a foreign gallery", async () => {
    const g = await createGallery(a, { title: "G" });
    await expect(
      createSet(b, { galleryId: g.id, title: "S", type: "photo" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("galleryOverview", () => {
  it("aggregates media count and storage per gallery, per account", async () => {
    const g = await createGallery(a, { title: "G" });
    await createGallery(a, { title: "Leer" });
    await createGallery(b, { title: "Fremd" });
    const s = await createSet(a, {
      galleryId: g.id,
      title: "S",
      type: "photo",
    });
    await db.insert(media).values([
      { accountId: a.accountId, setId: s.id, type: "photo", sizeBytes: 1000 },
      { accountId: a.accountId, setId: s.id, type: "photo", sizeBytes: 500 },
    ]);
    const rows = await galleryOverview(a);
    expect(rows).toHaveLength(2);
    const full = rows.find((r) => r.id === g.id)!;
    expect(full).toMatchObject({ mediaCount: 2, storageBytes: 1500 });
    expect(rows.find((r) => r.title === "Leer")).toMatchObject({
      mediaCount: 0,
      storageBytes: 0,
    });
  });
});

describe("ordering and cover", () => {
  it("reorders sets and rejects incomplete or foreign lists", async () => {
    const g = await createGallery(a, { title: "G" });
    const ids: string[] = [];
    for (const title of ["A", "B", "C"])
      ids.push(
        (await createSet(a, { galleryId: g.id, title, type: "photo" })).id,
      );

    await reorderSets(a, g.id, [ids[2], ids[0], ids[1]]);
    const rows = await tenantDb(db, a.accountId).sets.list();
    expect(
      rows.sort((x, y) => x.position - y.position).map((r) => r.title),
    ).toEqual(["C", "A", "B"]);

    await expect(reorderSets(a, g.id, [ids[0], ids[1]])).rejects.toMatchObject({
      code: "invalid_state",
    });
    await expect(
      reorderSets(a, g.id, [ids[0], ids[0], ids[1]]),
    ).rejects.toMatchObject({ code: "invalid_state" });
    await expect(reorderSets(b, g.id, ids)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("reorders media within a set only", async () => {
    const g = await createGallery(a, { title: "G" });
    const s1 = await createSet(a, {
      galleryId: g.id,
      title: "S1",
      type: "photo",
    });
    const s2 = await createSet(a, {
      galleryId: g.id,
      title: "S2",
      type: "photo",
    });
    const add = (setId: string) =>
      db
        .insert(media)
        .values({ accountId: a.accountId, setId, type: "photo" })
        .returning();
    const [m1] = await add(s1.id);
    const [m2] = await add(s1.id);
    const [other] = await add(s2.id);

    await reorderMedia(a, s1.id, [m2.id, m1.id]);
    const t = tenantDb(db, a.accountId);
    expect((await t.media.get(m2.id))?.position).toBe(0);
    expect((await t.media.get(m1.id))?.position).toBe(1);
    await expect(
      reorderMedia(a, s1.id, [m2.id, other.id]),
    ).rejects.toMatchObject({
      code: "invalid_state",
    });
    await expect(reorderMedia(b, s1.id, [m1.id, m2.id])).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("sets and clears the cover without touching other fields", async () => {
    const g = await createGallery(a, {
      title: "G",
      expiresAt: "2027-01-01",
    });
    const s = await createSet(a, {
      galleryId: g.id,
      title: "S",
      type: "photo",
    });
    const [m] = await db
      .insert(media)
      .values({ accountId: a.accountId, setId: s.id, type: "photo" })
      .returning();
    const withCover = await setGalleryCover(a, g.id, m.id);
    expect(withCover.coverMediaId).toBe(m.id);
    expect(withCover.expiresAt?.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect((await setGalleryCover(a, g.id, null)).coverMediaId).toBeNull();
  });
});
