import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, themes } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { createGallery, GalleryError } from "./galleries";
import { galleryDesign, listThemes, saveGalleryDesign } from "./gallery-design";
import { SYSTEM_THEMES } from "./themes";

const { db, close } = createTestDb();
let a: { db: typeof db; accountId: string };
let b: { db: typeof db; accountId: string };
const dark = SYSTEM_THEMES[3];

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

describe("gallery design", () => {
  it("falls back to the default theme", async () => {
    const g = await createGallery(a, { title: "Hochzeit" });
    const d = await galleryDesign(a, g.id);
    expect(d.themeId).toBe(SYSTEM_THEMES[0].id);
    expect(d.config).toEqual(SYSTEM_THEMES[0].config);
    expect(d.themes).toHaveLength(4);
  });

  it("stores a plain theme choice without overrides", async () => {
    const g = await createGallery(a, { title: "Hochzeit" });
    await saveGalleryDesign(a, {
      galleryId: g.id,
      themeId: dark.id,
      config: dark.config,
    });
    const d = await galleryDesign(a, g.id);
    expect(d.themeId).toBe(dark.id);
    expect(d.config).toEqual(dark.config);
  });

  it("keeps customisations as overrides", async () => {
    const g = await createGallery(a, { title: "Hochzeit" });
    const config = {
      ...dark.config,
      colors: { ...dark.config.colors, accent: "#ff0000" },
    };
    await saveGalleryDesign(a, {
      galleryId: g.id,
      themeId: dark.id,
      config,
    });
    expect((await galleryDesign(a, g.id)).config.colors.accent).toBe("#ff0000");
  });

  it("rejects invalid configs", async () => {
    const g = await createGallery(a, { title: "Hochzeit" });
    const config = {
      ...dark.config,
      colors: { ...dark.config.colors, accent: "red" },
    };
    await expect(
      saveGalleryDesign(a, { galleryId: g.id, themeId: dark.id, config }),
    ).rejects.toThrow();
  });

  it("isolates tenants", async () => {
    const g = await createGallery(a, { title: "Hochzeit" });
    await expect(
      saveGalleryDesign(b, {
        galleryId: g.id,
        themeId: dark.id,
        config: dark.config,
      }),
    ).rejects.toBeInstanceOf(GalleryError);
    await expect(galleryDesign(b, g.id)).rejects.toBeInstanceOf(GalleryError);

    const [own] = await db
      .insert(themes)
      .values({ accountId: a.accountId, name: "Eigen", config: dark.config })
      .returning();
    expect((await listThemes(a)).map((t) => t.id)).toContain(own.id);
    expect((await listThemes(b)).map((t) => t.id)).not.toContain(own.id);
    const h = await createGallery(b, { title: "Andere" });
    await expect(
      saveGalleryDesign(b, {
        galleryId: h.id,
        themeId: own.id,
        config: dark.config,
      }),
    ).rejects.toBeInstanceOf(GalleryError);
  });
});
