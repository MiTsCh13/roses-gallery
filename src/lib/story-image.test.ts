import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, media, sets } from "@/db/schema";
import { FakeStorage } from "@/lib/storage/fake";
import { createTestDb, resetDb, linkSetMedia } from "@/test/db";
import { renderStory, resolveStoryImage } from "./story-image";

const { db, close } = createTestDb();
const storage = new FakeStorage(
  mkdtempSync(path.join(os.tmpdir(), "roses-story-")),
  "secret",
);
let accountId: string;

const photo = (w: number, h: number) =>
  sharp({
    create: { width: w, height: h, channels: 3, background: "#3366cc" },
  })
    .webp()
    .toBuffer();

async function setup(
  galleryValues: Partial<typeof galleries.$inferInsert> = {},
  setPolicy: "none" | "web" | "original" | null = null,
) {
  const [g] = await db
    .insert(galleries)
    .values({
      accountId,
      slug: "anna-ben",
      title: "Anna & Ben <3",
      status: "published",
      ...galleryValues,
    })
    .returning();
  const [set] = await db
    .insert(sets)
    .values({
      accountId,
      galleryId: g.id,
      title: "T",
      downloadPolicy: setPolicy,
    })
    .returning();
  const [m] = await db
    .insert(media)
    .values({
      accountId,
      setId: set.id,
      type: "photo",
      processingStatus: "ready",
      variants: {
        "1200": {
          key: `${accountId}/m/r1-1200.webp`,
          width: 1200,
          height: 800,
          size: 1,
        },
      },
    })
    .returning();
  await storage.put(`${accountId}/m/r1-1200.webp`, await photo(1200, 800));
  await linkSetMedia(db);
  return m;
}

beforeEach(async () => {
  await resetDb(db);
  const [a] = await db.insert(accounts).values({ name: "A" }).returning();
  accountId = a.id;
});
afterAll(close);

describe("renderStory", () => {
  it("makes a 1080×1920 JPEG for landscape and portrait photos", async () => {
    for (const [w, h] of [
      [1200, 800],
      [800, 1200],
    ]) {
      const out = await renderStory(await photo(w, h), "Anna & Ben <3");
      const meta = await sharp(out).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([
        "jpeg",
        1080,
        1920,
      ]);
    }
  });
});

describe("resolveStoryImage", () => {
  it("renders for visible photos when web downloads are allowed", async () => {
    const m = await setup();
    const r = await resolveStoryImage(
      { db, storage },
      { slug: "anna-ben", mediaId: m.id },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect((await sharp(r.jpeg).metadata()).height).toBe(1920);
  });

  it("is forbidden when downloads are off for the gallery", async () => {
    const m = await setup({ downloadPolicy: "none" });
    expect(
      await resolveStoryImage(
        { db, storage },
        { slug: "anna-ben", mediaId: m.id },
      ),
    ).toEqual({ ok: false, reason: "forbidden" });
  });

  it("hides drafts, unknown photos and junk ids", async () => {
    const m = await setup({ status: "draft" });
    for (const mediaId of [m.id, crypto.randomUUID(), "x"]) {
      expect(
        await resolveStoryImage({ db, storage }, { slug: "anna-ben", mediaId }),
      ).toEqual({ ok: false, reason: "not_found" });
    }
  });
});
