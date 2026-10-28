import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { accounts, media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { FakeStorage } from "@/lib/storage/fake";
import { originalKey } from "@/lib/storage/types";
import { createTestDb, resetDb } from "@/test/db";
import { STALE_UPLOAD_MS, cleanupStaleUploads } from "./upload-cleanup";

const { db, close } = createTestDb();
let dir: string;
let storage: FakeStorage;
let accountId: string;
let setId: string;

beforeEach(async () => {
  await resetDb(db);
  dir = await mkdtemp(path.join(os.tmpdir(), "cleanup-"));
  storage = new FakeStorage(dir, "secret-secret-secret");
  [{ id: accountId }] = await db
    .insert(accounts)
    .values([{ name: "A" }])
    .returning();
  const t = tenantDb(db, accountId);
  const gallery = await t.galleries.create({ slug: "g", title: "G" });
  ({ id: setId } = await t.sets.create({ galleryId: gallery.id, title: "S" }));
});
afterEach(() => rm(dir, { recursive: true, force: true }));
afterAll(() => close());

async function seed(body: Buffer | null) {
  const row = await tenantDb(db, accountId).media.create({
    setId,
    type: "photo",
    sizeBytes: body?.length ?? 1000,
    processingStatus: "pending",
  });
  const key = originalKey(accountId, row.id, row.revision);
  if (body) await storage.put(key, body);
  await tenantDb(db, accountId).media.update(row.id, { originalKey: key });
  return row.id;
}

const later = new Date(Date.now() + STALE_UPLOAD_MS + 60_000);

describe("cleanupStaleUploads", () => {
  it("removes abandoned uploads whose original never arrived", async () => {
    const id = await seed(null);
    expect(await cleanupStaleUploads({ db, storage }, later)).toEqual({
      removed: 1,
      retried: 0,
    });
    expect(await tenantDb(db, accountId).media.get(id)).toBeUndefined();
  });

  it("keeps recent uploads untouched", async () => {
    const id = await seed(null);
    expect(await cleanupStaleUploads({ db, storage })).toEqual({
      removed: 0,
      retried: 0,
    });
    expect(await tenantDb(db, accountId).media.get(id)).toBeDefined();
  });

  it("processes uploaded originals whose job got lost", async () => {
    const body = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#c44" },
    })
      .jpeg()
      .toBuffer();
    const id = await seed(body);
    expect(await cleanupStaleUploads({ db, storage }, later)).toEqual({
      removed: 0,
      retried: 1,
    });
    const [row] = await db.select().from(media).where(eq(media.id, id));
    expect(row.processingStatus).toBe("ready");
  });
});
