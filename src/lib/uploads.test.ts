import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ZodError } from "zod";

import { accounts } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { PlanLimitError } from "@/lib/plans";
import { FakeStorage } from "@/lib/storage/fake";
import { createTestDb, resetDb } from "@/test/db";
import {
  abortUpload,
  completeReplacement,
  completeUpload,
  signUploadPart,
  startReplacement,
  startUpload,
  UploadError,
} from "./uploads";

const { db, close } = createTestDb();
let dir: string;
let storage: FakeStorage;
let accountId: string;
let otherId: string;
let setId: string;

const deps = () => ({ db, storage, accountId });

beforeEach(async () => {
  await resetDb(db);
  dir = await mkdtemp(path.join(os.tmpdir(), "uploads-"));
  storage = new FakeStorage(dir, "secret-secret-secret");
  [{ id: accountId }, { id: otherId }] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  const gallery = await tenantDb(db, accountId).galleries.create({
    slug: "g",
    title: "G",
  });
  ({ id: setId } = await tenantDb(db, accountId).sets.create({
    galleryId: gallery.id,
    title: "S",
  }));
});
afterEach(() => rm(dir, { recursive: true, force: true }));
afterAll(() => close());

async function uploadAll(body: Buffer) {
  const start = await startUpload(deps(), {
    setId,
    contentType: "image/jpeg",
    sizeBytes: body.length,
  });
  const etag = await storage.storePart(start.uploadId, 1, body);
  return { start, parts: [{ partNumber: 1, etag }] };
}

describe("uploads", () => {
  it("runs start → sign → complete and hands over to processing", async () => {
    const body = Buffer.from("jpeg-bytes");
    const { start, parts } = await uploadAll(body);
    expect(start.partCount).toBe(1);

    const { url } = await signUploadPart(deps(), {
      mediaId: start.mediaId,
      uploadId: start.uploadId,
      partNumber: 1,
    });
    expect(url).toContain("/api/test/storage");

    const onUploaded = vi.fn(async () => {});
    await completeUpload(
      deps(),
      { mediaId: start.mediaId, uploadId: start.uploadId, parts },
      onUploaded,
    );
    expect(onUploaded).toHaveBeenCalledWith({ id: start.mediaId, revision: 1 });

    const row = await tenantDb(db, accountId).media.get(start.mediaId);
    expect(row).toMatchObject({
      type: "photo",
      sizeBytes: body.length,
      processingStatus: "pending",
      originalKey: `${accountId}/${start.mediaId}/original-1`,
      position: 0,
    });
    expect(await storage.head(row!.originalKey!)).toEqual({
      size: body.length,
    });
  });

  it("appends to the end of the set", async () => {
    await uploadAll(Buffer.from("a"));
    const second = await uploadAll(Buffer.from("b"));
    const row = await tenantDb(db, accountId).media.get(second.start.mediaId);
    expect(row?.position).toBe(1);
  });

  it("rejects invalid input", async () => {
    await expect(
      startUpload(deps(), { setId, contentType: "text/html", sizeBytes: 1 }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      startUpload(deps(), { setId, contentType: "image/jpeg", sizeBytes: 0 }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("does not use another account's set or media", async () => {
    await expect(
      startUpload(
        { db, storage, accountId: otherId },
        { setId, contentType: "image/jpeg", sizeBytes: 10 },
      ),
    ).rejects.toMatchObject({ code: "not_found" });

    const { start } = await uploadAll(Buffer.from("x"));
    await expect(
      signUploadPart(
        { db, storage, accountId: otherId },
        { mediaId: start.mediaId, uploadId: start.uploadId, partNumber: 1 },
      ),
    ).rejects.toBeInstanceOf(UploadError);
  });

  it("blocks uploads beyond the storage quota", async () => {
    await db
      .update(accounts)
      .set({ storageUsedBytes: 2 * 1024 ** 3 - 5 })
      .where(eq(accounts.id, accountId));
    await expect(
      startUpload(deps(), { setId, contentType: "image/jpeg", sizeBytes: 10 }),
    ).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("re-checks the real size on completion and cleans up", async () => {
    const start = await startUpload(deps(), {
      setId,
      contentType: "image/jpeg",
      sizeBytes: 3,
    });
    await db
      .update(accounts)
      .set({ storageUsedBytes: 2 * 1024 ** 3 - 5 })
      .where(eq(accounts.id, accountId));
    const etag = await storage.storePart(start.uploadId, 1, Buffer.alloc(100));
    await expect(
      completeUpload(
        deps(),
        {
          mediaId: start.mediaId,
          uploadId: start.uploadId,
          parts: [{ partNumber: 1, etag }],
        },
        async () => {},
      ),
    ).rejects.toBeInstanceOf(PlanLimitError);
    expect(
      await tenantDb(db, accountId).media.get(start.mediaId),
    ).toBeUndefined();
    expect(await storage.listKeys()).toEqual([]);
  });

  it("aborts an upload and removes the row", async () => {
    const { start } = await uploadAll(Buffer.from("x"));
    await abortUpload(deps(), {
      mediaId: start.mediaId,
      uploadId: start.uploadId,
    });
    expect(
      await tenantDb(db, accountId).media.get(start.mediaId),
    ).toBeUndefined();
  });
});

describe("replacement", () => {
  async function readyPhoto(body: Buffer) {
    const { start, parts } = await uploadAll(body);
    await completeUpload(
      deps(),
      { mediaId: start.mediaId, uploadId: start.uploadId, parts },
      async () => {},
    );
    // Pretend the worker finished: one variant, bytes booked.
    const variantKey = `${accountId}/${start.mediaId}/r1-400.webp`;
    await storage.put(variantKey, Buffer.from("variant"));
    await tenantDb(db, accountId).media.update(start.mediaId, {
      processingStatus: "ready",
      variants: { "400": { key: variantKey, size: 7 } },
    });
    await db
      .update(accounts)
      .set({ storageUsedBytes: body.length + 7 })
      .where(eq(accounts.id, accountId));
    return { mediaId: start.mediaId, variantKey };
  }

  it("keeps id and position, bumps the revision and releases old bytes", async () => {
    await uploadAll(Buffer.from("first"));
    const { mediaId, variantKey } = await readyPhoto(Buffer.from("old-bytes"));
    const before = await tenantDb(db, accountId).media.get(mediaId);

    const start = await startReplacement(deps(), {
      mediaId,
      contentType: "image/jpeg",
      sizeBytes: 3,
    });
    const etag = await storage.storePart(start.uploadId, 1, Buffer.from("new"));
    const onUploaded = vi.fn(async () => {});
    await completeReplacement(
      deps(),
      { mediaId, uploadId: start.uploadId, parts: [{ partNumber: 1, etag }] },
      onUploaded,
    );

    expect(onUploaded).toHaveBeenCalledWith({ id: mediaId, revision: 2 });
    const row = await tenantDb(db, accountId).media.get(mediaId);
    expect(row).toMatchObject({
      id: mediaId,
      position: before!.position,
      revision: 2,
      sizeBytes: 3,
      processingStatus: "pending",
      originalKey: `${accountId}/${mediaId}/original-2`,
    });
    expect(row?.variants).toEqual({});
    expect(await storage.head(before!.originalKey!)).toBeNull();
    expect(await storage.head(variantKey)).toBeNull();
    const [acc] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    expect(acc.storageUsedBytes).toBe(0);
  });

  it("only replaces finished media of the own account", async () => {
    const { start } = await uploadAll(Buffer.from("pending"));
    const input = {
      mediaId: start.mediaId,
      contentType: "image/jpeg",
      sizeBytes: 1,
    };
    await expect(startReplacement(deps(), input)).rejects.toMatchObject({
      code: "invalid_state",
    });
    const { mediaId } = await readyPhoto(Buffer.from("x"));
    await expect(
      startReplacement(
        { db, storage, accountId: otherId },
        { ...input, mediaId },
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("checks the quota for the growth only", async () => {
    const { mediaId } = await readyPhoto(Buffer.from("12345"));
    await db
      .update(accounts)
      .set({ storageUsedBytes: 2 * 1024 ** 3 })
      .where(eq(accounts.id, accountId));
    await expect(
      startReplacement(deps(), {
        mediaId,
        contentType: "image/jpeg",
        sizeBytes: 5,
      }),
    ).resolves.toBeDefined();
    await expect(
      startReplacement(deps(), {
        mediaId,
        contentType: "image/jpeg",
        sizeBytes: 50,
      }),
    ).rejects.toBeInstanceOf(PlanLimitError);
  });
});
