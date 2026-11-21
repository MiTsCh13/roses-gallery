import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { accounts, media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { PlanLimitError } from "@/lib/plans";
import { FakeVideoProvider } from "@/lib/video/fake";
import { createTestDb, resetDb } from "@/test/db";
import {
  originalUrl,
  playbackUrl,
  removeVideo,
  startVideoUpload,
  syncVideo,
  syncVideoByProviderId,
  VideoError,
} from "./videos";

const { db, close } = createTestDb();
let video: FakeVideoProvider;
let accountId: string;
let otherId: string;
let folderId: string;

const deps = () => ({ db, video, accountId });
const used = async (id = accountId) =>
  (await db.select().from(accounts).where(eq(accounts.id, id)))[0]
    .storageUsedBytes;

beforeEach(async () => {
  await resetDb(db);
  video = new FakeVideoProvider();
  [{ id: accountId }, { id: otherId }] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  const t = tenantDb(db, accountId);
  ({ id: folderId } = await t.folders.create({ name: "F" }));
});
afterAll(() => close());

const start = (sizeBytes = 1000) =>
  startVideoUpload(deps(), { folderId, title: "Trauung", sizeBytes });

describe("library video uploads", () => {
  it("creates a video in the given folder", async () => {
    const t = tenantDb(db, accountId);
    const folder = await t.folders.create({ name: "F" });
    const { mediaId } = await startVideoUpload(deps(), {
      folderId: folder.id,
      title: "Film",
      sizeBytes: 10,
    });
    const row = await t.media.get(mediaId);
    expect(row?.folderId).toBe(folder.id);
  });

  it("rejects a folder of another account", async () => {
    const foreign = await tenantDb(db, otherId).folders.create({ name: "X" });
    await expect(
      startVideoUpload(deps(), {
        folderId: foreign.id,
        title: "Film",
        sizeBytes: 10,
      }),
    ).rejects.toBeInstanceOf(VideoError);
  });
});

describe("videos", () => {
  it("creates a pending video with tus settings", async () => {
    const { mediaId, tus } = await start();
    const row = await tenantDb(db, accountId).media.get(mediaId);
    expect(row).toMatchObject({
      type: "video",
      processingStatus: "pending",
      sizeBytes: 1000,
    });
    expect(row?.bunnyVideoId).toBeTruthy();
    expect(tus.headers.VideoId).toBe(row?.bunnyVideoId);
    expect(await used()).toBe(0);
  });

  it("rejects foreign folders and bad input", async () => {
    await expect(
      startVideoUpload(
        { db, video, accountId: otherId },
        { folderId, title: "x", sizeBytes: 1 },
      ),
    ).rejects.toBeInstanceOf(VideoError);
    await expect(
      startVideoUpload(deps(), { folderId, title: "", sizeBytes: 1 }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("blocks uploads beyond the storage quota", async () => {
    await expect(start(3 * 1024 ** 3)).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("books the size exactly once when the video becomes ready", async () => {
    const { mediaId } = await start(5000);
    const row = await tenantDb(db, accountId).media.get(mediaId);
    const id = row!.bunnyVideoId!;

    video.set(id, { status: "processing" });
    expect(await syncVideo(deps(), mediaId)).toEqual({ status: "processing" });
    expect(await used()).toBe(0);

    video.set(id, {
      status: "ready",
      durationS: 90,
      width: 3840,
      height: 2160,
    });
    await Promise.all([syncVideo(deps(), mediaId), syncVideo(deps(), mediaId)]);
    await syncVideo(deps(), mediaId);

    const ready = await tenantDb(db, accountId).media.get(mediaId);
    expect(ready).toMatchObject({
      processingStatus: "ready",
      durationS: 90,
      width: 3840,
      height: 2160,
    });
    expect(await used()).toBe(5000);
  });

  it("marks failed videos and never books them", async () => {
    const { mediaId } = await start();
    const row = await tenantDb(db, accountId).media.get(mediaId);
    video.set(row!.bunnyVideoId!, { status: "failed" });
    await syncVideo(deps(), mediaId);
    expect(
      (await tenantDb(db, accountId).media.get(mediaId))?.processingStatus,
    ).toBe("failed");
    expect(await used()).toBe(0);
  });

  it("syncs by provider id (webhook) and ignores unknown ids", async () => {
    const { mediaId } = await start(10);
    const row = await tenantDb(db, accountId).media.get(mediaId);
    video.set(row!.bunnyVideoId!, { status: "ready" });
    expect(await syncVideoByProviderId(db, video, "nope")).toBeNull();
    await syncVideoByProviderId(db, video, row!.bunnyVideoId!);
    expect(await used()).toBe(10);
  });

  it("signs playback only for ready videos of the own account", async () => {
    const { mediaId } = await start();
    await expect(playbackUrl(deps(), { mediaId })).rejects.toMatchObject({
      code: "invalid_state",
    });
    const row = await tenantDb(db, accountId).media.get(mediaId);
    video.set(row!.bunnyVideoId!, { status: "ready" });
    await syncVideo(deps(), mediaId);
    expect((await playbackUrl(deps(), { mediaId })).url).toContain(
      row!.bunnyVideoId!,
    );
    await expect(
      playbackUrl({ db, video, accountId: otherId }, { mediaId }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("signs original downloads only for ready videos of the own account", async () => {
    const { mediaId } = await start();
    await expect(originalUrl(deps(), { mediaId })).rejects.toMatchObject({
      code: "invalid_state",
    });
    const row = await tenantDb(db, accountId).media.get(mediaId);
    video.set(row!.bunnyVideoId!, { status: "ready" });
    await syncVideo(deps(), mediaId);
    expect((await originalUrl(deps(), { mediaId })).url).toContain(
      row!.bunnyVideoId!,
    );
    await expect(
      originalUrl({ db, video, accountId: otherId }, { mediaId }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("removes the video and frees booked bytes", async () => {
    const { mediaId } = await start(700);
    const row = await tenantDb(db, accountId).media.get(mediaId);
    video.set(row!.bunnyVideoId!, { status: "ready" });
    await syncVideo(deps(), mediaId);
    await expect(
      removeVideo({ db, video, accountId: otherId }, { mediaId }),
    ).rejects.toBeInstanceOf(VideoError);
    await removeVideo(deps(), { mediaId });
    expect(await db.select().from(media)).toHaveLength(0);
    expect(video.videos.has(row!.bunnyVideoId!)).toBe(false);
    expect(await used()).toBe(0);
  });
});
