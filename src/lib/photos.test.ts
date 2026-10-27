import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { accounts } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { FakeStorage } from "@/lib/storage/fake";
import { originalKey } from "@/lib/storage/types";
import { createTestDb, resetDb } from "@/test/db";
import { processPhoto } from "./photos";

const { db, close } = createTestDb();
let dir: string;
let storage: FakeStorage;
let accountId: string;
let otherId: string;
let setId: string;

beforeEach(async () => {
  await resetDb(db);
  dir = await mkdtemp(path.join(os.tmpdir(), "photos-"));
  storage = new FakeStorage(dir, "secret-secret-secret");
  [{ id: accountId }, { id: otherId }] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  const t = tenantDb(db, accountId);
  const gallery = await t.galleries.create({ slug: "g", title: "G" });
  ({ id: setId } = await t.sets.create({ galleryId: gallery.id, title: "S" }));
});
afterEach(() => rm(dir, { recursive: true, force: true }));
afterAll(() => close());

async function jpeg(width: number, height: number, exif = true) {
  let img = sharp({
    create: { width, height, channels: 3, background: "#c44" },
  }).jpeg();
  if (exif) {
    img = img.withExif({ IFD2: { DateTimeOriginal: "2025:06:14 15:30:00" } });
  }
  return img.toBuffer();
}

async function seed(body: Buffer, owner = accountId) {
  const row = await tenantDb(db, owner).media.create({
    setId,
    type: "photo",
    sizeBytes: body.length,
    processingStatus: "pending",
  });
  const key = originalKey(owner, row.id, row.revision);
  await storage.put(key, body);
  await tenantDb(db, owner).media.update(row.id, { originalKey: key });
  return row.id;
}

const used = async (id: string) =>
  (await db.select().from(accounts).where(eq(accounts.id, id)))[0]
    .storageUsedBytes;

describe("processPhoto", () => {
  it("creates capped WebP variants, reads EXIF and books storage", async () => {
    const body = await jpeg(3000, 2000);
    const mediaId = await seed(body);

    const result = await processPhoto({ db, storage }, { accountId, mediaId });
    expect(result.status).toBe("ready");

    const row = await tenantDb(db, accountId).media.get(mediaId);
    expect(row).toMatchObject({
      processingStatus: "ready",
      width: 3000,
      height: 2000,
    });
    expect(row?.takenAt?.getFullYear()).toBe(2025);
    const variants = row!.variants as Record<
      string,
      { key: string; width: number; size: number }
    >;
    expect(Object.keys(variants)).toEqual(["400", "1200", "2400"]);
    expect(variants["400"].width).toBe(400);
    expect(variants["2400"].width).toBe(2400);
    const thumb = await storage.get(variants["400"].key);
    expect((await sharp(thumb).metadata()).format).toBe("webp");

    const derived = Object.values(variants).reduce((n, v) => n + v.size, 0);
    expect(await used(accountId)).toBe(body.length + derived);
  });

  it("never upscales small images", async () => {
    const mediaId = await seed(await jpeg(300, 200, false));
    await processPhoto({ db, storage }, { accountId, mediaId });
    const row = await tenantDb(db, accountId).media.get(mediaId);
    const variants = row!.variants as Record<string, { width: number }>;
    expect(variants["2400"].width).toBe(300);
    expect(row?.takenAt).toBeNull();
  });

  it("books storage only once when the job is retried or repeated", async () => {
    const mediaId = await seed(await jpeg(800, 600));
    await processPhoto({ db, storage }, { accountId, mediaId });
    const after = await used(accountId);
    const again = await processPhoto({ db, storage }, { accountId, mediaId });
    expect(again.status).toBe("skipped");
    expect(await used(accountId)).toBe(after);
  });

  it("marks broken files as failed and throws", async () => {
    const mediaId = await seed(Buffer.from("not an image"));
    await expect(
      processPhoto({ db, storage }, { accountId, mediaId }),
    ).rejects.toThrow();
    const row = await tenantDb(db, accountId).media.get(mediaId);
    expect(row?.processingStatus).toBe("failed");
    expect(await used(accountId)).toBe(0);
  });

  it("ignores media of another account", async () => {
    const mediaId = await seed(await jpeg(800, 600));
    const result = await processPhoto(
      { db, storage },
      { accountId: otherId, mediaId },
    );
    expect(result.status).toBe("skipped");
    const row = await tenantDb(db, accountId).media.get(mediaId);
    expect(row?.processingStatus).toBe("pending");
    expect(await used(otherId)).toBe(0);
  });
});
