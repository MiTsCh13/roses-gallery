import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, media, sets, zipExports } from "@/db/schema";
import { FakeStorage } from "@/lib/storage/fake";
import { createTestDb, resetDb, linkSetMedia } from "@/test/db";
import { FakeMailer } from "@/lib/mailer";
import { buildZipExport } from "./zip-exports";
import { resolvePhotoDownload } from "./downloads";
import { resolveGalleryImage } from "./gallery-image";
import { loadPublicGallery } from "./public-gallery";
import {
  applyWatermark,
  DEFAULT_WATERMARK,
  ensureWatermarked,
  loadStamp,
  readWatermarkConfig,
  saveWatermarkConfig,
} from "./watermark";

const { db, close } = createTestDb();
const storage = new FakeStorage(
  mkdtempSync(path.join(os.tmpdir(), "roses-wm-")),
  "secret",
);

const solid = (w: number, h: number, rgb: [number, number, number]) =>
  sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: rgb[0], g: rgb[1], b: rgb[2] },
    },
  })
    .png()
    .toBuffer();

async function pixel(buf: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buf)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

let accountId: string;

async function setup(enabled = true) {
  await storage.put(
    `${accountId}/branding/logo-1.png`,
    await solid(100, 100, [255, 0, 0]),
  );
  await db
    .update(accounts)
    .set({ branding: { logoKey: `${accountId}/branding/logo-1.png` } })
    .where(eq(accounts.id, accountId));
  const [g] = await db
    .insert(galleries)
    .values({
      accountId,
      slug: "anna-ben",
      title: "A",
      status: "published",
      watermarkEnabled: enabled,
      coverMediaId: null,
    })
    .returning();
  const [set] = await db
    .insert(sets)
    .values({ accountId, galleryId: g.id, title: "T" })
    .returning();
  const [photo] = await db
    .insert(media)
    .values({
      accountId,
      setId: set.id,
      type: "photo",
      processingStatus: "ready",
      originalKey: `${accountId}/m/original-1`,
      variants: {
        "400": {
          key: `${accountId}/m/r1-400.webp`,
          width: 400,
          height: 300,
          size: 1,
        },
        "1200": {
          key: `${accountId}/m/r1-1200.webp`,
          width: 400,
          height: 300,
          size: 1,
        },
      },
    })
    .returning();
  const img = await sharp(await solid(400, 300, [0, 0, 255]))
    .webp()
    .toBuffer();
  await storage.put(`${accountId}/m/r1-400.webp`, img);
  await storage.put(`${accountId}/m/r1-1200.webp`, img);
  await storage.put(`${accountId}/m/original-1`, img);
  await linkSetMedia(db);
  return { g, photo };
}

beforeEach(async () => {
  await resetDb(db);
  const [a] = await db.insert(accounts).values({ name: "A" }).returning();
  accountId = a.id;
});
afterAll(close);

describe("applyWatermark", () => {
  it("stamps at the chosen corner with the given opacity", async () => {
    const out = await applyWatermark(
      await solid(400, 300, [0, 0, 255]),
      await solid(100, 100, [255, 0, 0]),
      { position: "bottom-right", opacity: 50, scale: 20 },
    );
    const [r, , b] = await pixel(out, 380 - 40, 285 - 40);
    // half red over blue (WebP is lossy, allow tolerance)
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
    expect(b).toBeGreaterThan(100);
    expect(await pixel(out, 10, 10)).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    const [r2, , b2] = await pixel(out, 10, 10);
    expect(r2).toBeLessThan(30);
    expect(b2).toBeGreaterThan(220);
  });

  it("keeps the logo inside small images", async () => {
    const out = await applyWatermark(
      await solid(100, 20, [0, 0, 255]),
      await solid(500, 500, [255, 0, 0]),
      { position: "center", opacity: 100, scale: 60 },
    );
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([100, 20]);
  });
});

describe("watermark config", () => {
  it("defaults, validates and persists", async () => {
    expect(readWatermarkConfig({})).toEqual(DEFAULT_WATERMARK);
    await saveWatermarkConfig(
      { db, accountId },
      { position: "center", opacity: "40", scale: "30" },
    );
    const [a] = await db.select().from(accounts);
    expect(readWatermarkConfig(a.branding)).toEqual({
      position: "center",
      opacity: 40,
      scale: 30,
    });
    await expect(
      saveWatermarkConfig(
        { db, accountId },
        { position: "x", opacity: 1, scale: 1 },
      ),
    ).rejects.toThrow();
  });

  it("has no stamp without a logo", async () => {
    expect(await loadStamp(db, accountId)).toBeNull();
  });
});

describe("stamped copies", () => {
  it("are created once and replaced when the settings change", async () => {
    const { photo } = await setup();
    const first = await ensureWatermarked(
      { db, storage },
      { accountId, media: photo, width: 400 },
    );
    expect(first).not.toBeNull();
    const again = await ensureWatermarked(
      { db, storage },
      { accountId, media: photo, width: 400 },
    );
    expect(again).toEqual(first);
    await saveWatermarkConfig(
      { db, accountId },
      { position: "top-left", opacity: 80, scale: 10 },
    );
    const changed = await ensureWatermarked(
      { db, storage },
      { accountId, media: photo, width: 400 },
    );
    expect(changed!.key).not.toBe(first!.key);
    expect(
      await ensureWatermarked(
        { db, storage },
        { accountId, media: photo, width: 999 },
      ),
    ).toBeNull();
  });

  it("serve gallery images, web downloads, never originals", async () => {
    const { photo } = await setup();
    const img = await resolveGalleryImage(
      { db, storage },
      { slug: "anna-ben", mediaId: photo.id, width: 400 },
    );
    expect(img.ok && img.url).toContain("wm");
    const web = await resolvePhotoDownload(
      { db, storage },
      { slug: "anna-ben", mediaId: photo.id, size: "web" },
    );
    expect(web.ok && web.url).toContain("wm");
    await db.update(galleries).set({ downloadPolicy: "original" });
    const original = await resolvePhotoDownload(
      { db, storage },
      { slug: "anna-ben", mediaId: photo.id, size: "original" },
    );
    expect(original.ok && original.url).not.toContain("wm");
  });

  it("are not used when the gallery has the watermark off", async () => {
    const { photo } = await setup(false);
    const img = await resolveGalleryImage(
      { db, storage },
      { slug: "anna-ben", mediaId: photo.id, width: 400 },
    );
    expect(img.ok && img.url).not.toContain("wm");
    const pub = await loadPublicGallery({ db, storage }, "anna-ben");
    const first = !pub?.locked ? pub?.items[0] : undefined;
    expect(first?.kind === "photo" && first.src).not.toContain("/img/");
  });

  it("route the public gallery through the stamping route", async () => {
    const { photo } = await setup();
    const pub = await loadPublicGallery({ db, storage }, "anna-ben");
    if (!pub || pub.locked) throw new Error("expected gallery");
    const item = pub.items[0];
    if (item.kind !== "photo") throw new Error("expected photo");
    expect(item.src).toBe(`/api/g/anna-ben/img/${photo.id}?w=1200`);
    expect(item.srcSet).toContain("?w=400");
  });

  it("refuse unpublished galleries and foreign media", async () => {
    const { g, photo } = await setup();
    expect(
      await resolveGalleryImage(
        { db, storage },
        { slug: "anna-ben", mediaId: crypto.randomUUID(), width: 400 },
      ),
    ).toEqual({ ok: false });
    await db
      .update(galleries)
      .set({ status: "draft" })
      .where(eq(galleries.id, g.id));
    expect(
      await resolveGalleryImage(
        { db, storage },
        { slug: "anna-ben", mediaId: photo.id, width: 400 },
      ),
    ).toEqual({ ok: false });
  });

  it("end up in web ZIPs", async () => {
    const { g } = await setup();
    const [row] = await db
      .insert(zipExports)
      .values({
        accountId,
        galleryId: g.id,
        size: "web",
        email: "gast@example.com",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    const result = await buildZipExport(
      {
        db,
        storage,
        mailer: new FakeMailer(),
        baseUrl: "https://roses.test",
      },
      { accountId, exportId: row.id },
    );
    expect(result.status).toBe("ready");
    const [done] = await db.select().from(zipExports);
    const zip = await storage.get(done.storageKey!);
    // stored (uncompressed) entry: the stamped file is larger than the flat one
    const plain = await storage.get(`${accountId}/m/r1-1200.webp`);
    expect(zip.length).toBeGreaterThan(plain.length);
    expect(zip.includes(Buffer.from("RIFF"))).toBe(true);
    const stamped = await loadStamp(db, accountId);
    expect(
      await storage.head(
        `${accountId}/${(await db.select().from(media))[0].id}/r1-1200-wm${stamped!.signature}.webp`,
      ),
    ).not.toBeNull();
  });
});
