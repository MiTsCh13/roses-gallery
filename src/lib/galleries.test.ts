import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleryMedia, media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { createTestDb, resetDb } from "@/test/db";
import {
  createGallery,
  galleryOverview,
  GalleryError,
  setGalleryCover,
  slugify,
  updateGallery,
} from "./galleries";
import { PlanLimitError } from "./plans";

const { db, close } = createTestDb();

// puts a new media row (own account) into the gallery
async function mediaIn(
  accountId: string,
  galleryId: string,
  values: Partial<typeof media.$inferInsert> = {},
) {
  const [m] = await db
    .insert(media)
    .values({ accountId, type: "photo", ...values })
    .returning();
  await db.insert(galleryMedia).values({ accountId, galleryId, mediaId: m.id });
  return m;
}
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

  it("stores the info text, keeps it on other updates and clears it", async () => {
    const g = await createGallery(a, { title: "Alt" });
    const base = { galleryId: g.id, title: "Alt", status: "draft" };
    expect(
      (await updateGallery(a, { ...base, description: "  Am See  " }))
        .description,
    ).toBe("Am See");
    // an update without the field (e.g. setting the cover) leaves it alone
    expect((await updateGallery(a, base)).description).toBe("Am See");
    expect(
      (await updateGallery(a, { ...base, description: "" })).description,
    ).toBeNull();
    await expect(
      updateGallery(a, { ...base, description: "x".repeat(301) }),
    ).rejects.toThrow();
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
    const m1 = await mediaIn(a.accountId, g1.id);
    const m2 = await mediaIn(a.accountId, g2.id);
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

describe("galleryOverview", () => {
  it("aggregates media count and storage per gallery, per account", async () => {
    const g = await createGallery(a, { title: "G" });
    await createGallery(a, { title: "Leer" });
    await createGallery(b, { title: "Fremd" });
    await mediaIn(a.accountId, g.id, { sizeBytes: 1000 });
    await mediaIn(a.accountId, g.id, { sizeBytes: 500 });
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
  it("sets and clears the cover without touching other fields", async () => {
    const g = await createGallery(a, {
      title: "G",
      expiresAt: "2027-01-01",
    });
    const m = await mediaIn(a.accountId, g.id);
    const withCover = await setGalleryCover(a, g.id, m.id);
    expect(withCover.coverMediaId).toBe(m.id);
    expect(withCover.expiresAt?.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect((await setGalleryCover(a, g.id, null)).coverMediaId).toBeNull();
  });
});
