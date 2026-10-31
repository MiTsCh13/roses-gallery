import { and, eq, isNull, max, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { accounts, media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { addToGallery } from "@/lib/library";
import { assertCanUpload, type SubscriptionStatus } from "@/lib/plans";
import type { VideoProvider } from "@/lib/video/types";

export const TUS_TTL_SECONDS = 6 * 60 * 60;
export const PLAYBACK_TTL_SECONDS = 4 * 60 * 60;
/** Videos have no length limit, but a size cap keeps a single upload sane. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024 * 1024;

export class VideoError extends Error {
  constructor(
    readonly code: "not_found" | "invalid_state",
    message: string,
  ) {
    super(message);
    this.name = "VideoError";
  }
}

export const startVideoSchema = z.object({
  // Without a set the video goes straight into the library (optionally a folder).
  setId: z.uuid().optional(),
  folderId: z.uuid().optional(),
  title: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive().max(MAX_VIDEO_BYTES),
});

export const videoRefSchema = z.object({ mediaId: z.uuid() });

type Deps = { db: Db; video: VideoProvider; accountId: string };

async function loadAccount({ db, accountId }: Deps) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) throw new VideoError("not_found", "Account not found.");
  return {
    ...account,
    subscriptionStatus: account.subscriptionStatus as SubscriptionStatus,
  };
}

async function ownVideo(deps: Deps, mediaId: string) {
  const row = await tenantDb(deps.db, deps.accountId).media.get(mediaId);
  if (!row || row.type !== "video" || !row.bunnyVideoId) {
    throw new VideoError("not_found", "Video not found.");
  }
  return { ...row, bunnyVideoId: row.bunnyVideoId };
}

/** Creates the media row and the provider video; returns tus upload settings. */
export async function startVideoUpload(deps: Deps, input: unknown) {
  const data = startVideoSchema.parse(input);
  assertCanUpload(await loadAccount(deps), data.sizeBytes);

  const t = tenantDb(deps.db, deps.accountId);
  const set = data.setId ? await t.sets.get(data.setId) : undefined;
  if (data.setId && (!set || set.type !== "video")) {
    throw new VideoError("not_found", "Video set not found.");
  }
  if (data.folderId && !(await t.folders.get(data.folderId))) {
    throw new VideoError("not_found", "Folder not found.");
  }

  const [{ top }] = await deps.db
    .select({ top: max(media.position) })
    .from(media)
    .where(
      and(
        eq(media.accountId, deps.accountId),
        set ? eq(media.setId, set.id) : isNull(media.setId),
      ),
    );

  const { videoId } = await deps.video.createVideo(data.title);
  const row = await t.media.create({
    setId: set?.id ?? null,
    folderId: set ? null : (data.folderId ?? null),
    type: "video",
    bunnyVideoId: videoId,
    sizeBytes: data.sizeBytes,
    position: (top ?? -1) + 1,
    processingStatus: "pending",
  });
  if (set) await addToGallery(deps, set.galleryId, row.id);
  const tus = await deps.video.createTusUpload(videoId, TUS_TTL_SECONDS);
  return { mediaId: row.id, tus };
}

/**
 * Pulls the provider's state into the media row. When the video becomes ready
 * its size is booked on the account exactly once (guarded by the status
 * transition, so webhook and manual refresh can race safely).
 */
export async function syncVideo(deps: Deps, mediaId: string) {
  const row = await ownVideo(deps, mediaId);
  const info = await deps.video.getVideo(row.bunnyVideoId);
  const status = info?.status ?? "failed";
  if (status === row.processingStatus) return { status };

  await deps.db.transaction(async (tx) => {
    const [moved] = await tx
      .update(media)
      .set({
        processingStatus: status,
        ...(status === "ready"
          ? {
              durationS: info?.durationS ?? null,
              width: info?.width ?? null,
              height: info?.height ?? null,
            }
          : {}),
      })
      .where(
        and(
          eq(media.id, row.id),
          eq(media.accountId, deps.accountId),
          sql`${media.processingStatus} <> 'ready'`,
          sql`${media.processingStatus} <> ${status}`,
        ),
      )
      .returning({ id: media.id });
    if (moved && status === "ready") {
      await tx
        .update(accounts)
        .set({
          storageUsedBytes: sql`${accounts.storageUsedBytes} + ${row.sizeBytes}`,
        })
        .where(eq(accounts.id, deps.accountId));
    }
  });
  return { status };
}

/** Webhook entry: the body is not trusted, only used to find the video. */
export async function syncVideoByProviderId(
  db: Db,
  video: VideoProvider,
  bunnyVideoId: string,
) {
  const [row] = await db
    .select({ id: media.id, accountId: media.accountId })
    .from(media)
    .where(and(eq(media.bunnyVideoId, bunnyVideoId), eq(media.type, "video")))
    .limit(1);
  if (!row) return null;
  return syncVideo({ db, video, accountId: row.accountId }, row.id);
}

/** Short-lived signed player URL; only for ready videos of the own account. */
export async function playbackUrl(deps: Deps, input: unknown) {
  const { mediaId } = videoRefSchema.parse(input);
  const row = await ownVideo(deps, mediaId);
  if (row.processingStatus !== "ready") {
    throw new VideoError("invalid_state", "Video is not ready.");
  }
  return {
    url: deps.video.signPlaybackUrl(row.bunnyVideoId, PLAYBACK_TTL_SECONDS),
  };
}

/** Signed download URL of the original; only for ready videos of the own account. */
export async function originalUrl(deps: Deps, input: unknown) {
  const { mediaId } = videoRefSchema.parse(input);
  const row = await ownVideo(deps, mediaId);
  if (row.processingStatus !== "ready") {
    throw new VideoError("invalid_state", "Video is not ready.");
  }
  return {
    url: deps.video.signOriginalUrl(row.bunnyVideoId, PLAYBACK_TTL_SECONDS),
  };
}

export async function removeVideo(deps: Deps, input: unknown) {
  const { mediaId } = videoRefSchema.parse(input);
  const row = await ownVideo(deps, mediaId);
  await deps.video.deleteVideo(row.bunnyVideoId);
  await deps.db.transaction(async (tx) => {
    await tx
      .delete(media)
      .where(and(eq(media.id, row.id), eq(media.accountId, deps.accountId)));
    if (row.processingStatus === "ready") {
      await tx
        .update(accounts)
        .set({
          storageUsedBytes: sql`greatest(${accounts.storageUsedBytes} - ${row.sizeBytes}, 0)`,
        })
        .where(eq(accounts.id, deps.accountId));
    }
  });
}
