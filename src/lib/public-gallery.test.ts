import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, media, sets, themes } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { FakeStorage } from "@/lib/storage/fake";
import { FakeVideoProvider } from "@/lib/video/fake";
import { SYSTEM_THEMES } from "@/lib/themes";
import { loadPublicGallery } from "./public-gallery";

const { db, close } = createTestDb();
const storage = new FakeStorage(
  mkdtempSync(path.join(os.tmpdir(), "roses-public-")),
  "secret",
);
let accountId: string;
let otherId: string;

async function gallery(values: Partial<typeof galleries.$inferInsert> = {}) {
  const [g] = await db
    .insert(galleries)
    .values({
      accountId,
      slug: "anna-ben",
      title: "Anna & Ben",
      status: "published",
      ...values,
    })
    .returning();
  return g;
}

beforeEach(async () => {
  await resetDb(db);
  const [a, b] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  accountId = a.id;
  otherId = b.id;
});
afterAll(close);

describe("loadPublicGallery", () => {
  it("returns a published gallery with ordered sets and default theme", async () => {
    const g = await gallery();
    await db.insert(sets).values([
      { accountId, galleryId: g.id, title: "Zweites", position: 1 },
      { accountId, galleryId: g.id, title: "Erstes", position: 0 },
    ]);
    const r = await loadPublicGallery({ db, storage }, "anna-ben");
    expect(r?.title).toBe("Anna & Ben");
    expect(r?.sets.map((s) => s.title)).toEqual(["Erstes", "Zweites"]);
    expect(r?.config).toEqual(SYSTEM_THEMES[0].config);
    expect(r?.logoUrl).toBeNull();
  });

  it("hides drafts, archived, expired and unknown galleries", async () => {
    await gallery({ slug: "draft", status: "draft" });
    await gallery({ slug: "archived", status: "archived" });
    await gallery({ slug: "expired", status: "expired" });
    await gallery({ slug: "past", expiresAt: new Date(Date.now() - 1000) });
    await gallery({ slug: "future", expiresAt: new Date(Date.now() + 1e6) });
    for (const slug of ["draft", "archived", "expired", "past", "nope"])
      expect(await loadPublicGallery({ db, storage }, slug)).toBeNull();
    expect(await loadPublicGallery({ db, storage }, "future")).not.toBeNull();
  });

  it("applies the system theme and ignores another account's theme", async () => {
    const dark = SYSTEM_THEMES.find((t) => t.name === "Dunkel")!;
    await gallery({ slug: "dark", themeId: dark.id });
    const [foreign] = await db
      .insert(themes)
      .values({
        accountId: otherId,
        name: "Fremd",
        config: { ...dark.config, cover: { style: "split" } },
      })
      .returning();
    await gallery({ slug: "foreign", themeId: foreign.id });
    expect((await loadPublicGallery({ db, storage }, "dark"))?.config).toEqual(
      dark.config,
    );
    expect(
      (await loadPublicGallery({ db, storage }, "foreign"))?.config,
    ).toEqual(SYSTEM_THEMES[0].config);
  });

  it("signs the account logo", async () => {
    await storage.put(`${accountId}/branding/logo.png`, Buffer.from("x"));
    await db
      .update(accounts)
      .set({ branding: { logoKey: `${accountId}/branding/logo.png` } })
      .where(eq(accounts.id, accountId));
    await gallery();
    const r = await loadPublicGallery({ db, storage }, "anna-ben");
    expect(r?.logoUrl).toContain("logo.png");
  });

  it("lists ready photos in order with signed srcset and the cover", async () => {
    const g = await gallery();
    const [set] = await db
      .insert(sets)
      .values({ accountId, galleryId: g.id, title: "Trauung" })
      .returning();
    const variants = (id: string) => ({
      "400": {
        key: `${accountId}/d/${id}-400.webp`,
        width: 400,
        height: 300,
        size: 1,
      },
      "1200": {
        key: `${accountId}/d/${id}-1200.webp`,
        width: 1200,
        height: 900,
        size: 1,
      },
      "2400": {
        key: `${accountId}/d/${id}-2400.webp`,
        width: 2400,
        height: 1800,
        size: 1,
      },
    });
    const base = { accountId, setId: set.id, type: "photo" as const };
    const [second, first] = await db
      .insert(media)
      .values([
        {
          ...base,
          position: 1,
          processingStatus: "ready",
          variants: variants("b"),
        },
        {
          ...base,
          position: 0,
          processingStatus: "ready",
          variants: variants("a"),
        },
        { ...base, position: 2, processingStatus: "pending" },
        { ...base, position: 3, processingStatus: "failed" },
      ])
      .returning();
    await db.update(galleries).set({ coverMediaId: second.id });
    const r = await loadPublicGallery({ db, storage }, "anna-ben");
    const photos = r!.sets[0].photos;
    expect(photos.map((p) => p.id)).toEqual([first.id, second.id]);
    expect(photos[0].srcSet.split(", ")).toHaveLength(3);
    expect(photos[0].srcSet).toMatch(/400w.*1200w.*2400w/);
    expect(photos[0].src).toContain("-1200.webp");
    expect(r!.coverUrl).toContain("b-2400.webp");
  });

  it("does not leak another account's media into the gallery", async () => {
    const g = await gallery();
    const [mine] = await db
      .insert(sets)
      .values({ accountId, galleryId: g.id, title: "Mein" })
      .returning();
    await db.insert(media).values({
      accountId: otherId,
      setId: mine.id,
      type: "photo",
      processingStatus: "ready",
      variants: {
        "400": { key: "x/400.webp", width: 400, height: 300, size: 1 },
      },
    });
    const r = await loadPublicGallery({ db, storage }, "anna-ben");
    expect(r!.sets[0].photos).toEqual([]);
  });

  it("lists only ready videos of the own account with signed play URLs", async () => {
    const video = new FakeVideoProvider();
    const g = await gallery();
    const [set] = await db
      .insert(sets)
      .values({ accountId, galleryId: g.id, title: "Filme", type: "video" })
      .returning();
    const base = { accountId, setId: set.id, type: "video" as const };
    await db.insert(media).values([
      {
        ...base,
        bunnyVideoId: "v-ready",
        processingStatus: "ready",
        durationS: 90,
      },
      { ...base, bunnyVideoId: "v-pending", processingStatus: "processing" },
    ]);
    const r = await loadPublicGallery({ db, storage, video }, "anna-ben");
    expect(r?.sets[0].videos).toHaveLength(1);
    expect(r?.sets[0].videos[0].durationS).toBe(90);
    expect(r?.sets[0].videos[0].playUrl).toContain("/api/test/player/v-ready?");
    expect(r?.sets[0].videos[0].hlsUrl).toBeUndefined();
    expect(r?.sets[0].photos).toEqual([]);
    // without a provider no video is exposed
    const none = await loadPublicGallery({ db, storage }, "anna-ben");
    expect(none?.sets[0].videos).toEqual([]);
  });
});
