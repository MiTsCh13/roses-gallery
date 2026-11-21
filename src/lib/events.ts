import { and, count, eq, gte, lt } from "drizzle-orm";

import type { Db } from "@/db";
import { events, galleryMedia, media, galleries } from "@/db/schema";

// Gallery statistics (F-DASH-02), data-sparing by design: no cookies, no IP
// addresses, no visitor ids. An event is only "what happened where and when",
// so the numbers are plain counts (no unique visitors).

export const EVENT_TYPES = ["view", "play", "download", "favorite"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

type Gallery = Pick<typeof galleries.$inferSelect, "id" | "accountId">;

/** Records one event. Statistics never break the request they belong to. */
export async function recordEvent(
  db: Db,
  gallery: Gallery,
  type: EventType,
  mediaId?: string | null,
) {
  try {
    await db.insert(events).values({
      accountId: gallery.accountId,
      galleryId: gallery.id,
      mediaId: mediaId ?? null,
      type,
    });
  } catch (error) {
    console.error("recordEvent failed", error);
  }
}

/** Records a video start if the video belongs to the (visible) gallery. */
export async function recordPlay(db: Db, gallery: Gallery, mediaId: string) {
  const [video] = await db
    .select({ id: media.id })
    .from(media)
    .innerJoin(galleryMedia, eq(galleryMedia.mediaId, media.id))
    .where(
      and(
        eq(media.id, mediaId),
        eq(media.accountId, gallery.accountId),
        eq(galleryMedia.galleryId, gallery.id),
        eq(media.type, "video"),
      ),
    )
    .limit(1);
  if (!video) return false;
  await recordEvent(db, gallery, "play", video.id);
  return true;
}

export type GalleryStats = Record<EventType, number>;

/** Event counts of one gallery within the last `days` days. */
export async function galleryStats(
  db: Db,
  accountId: string,
  galleryId: string,
  days: number,
  now = new Date(),
): Promise<GalleryStats> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ type: events.type, n: count() })
    .from(events)
    .where(
      and(
        eq(events.accountId, accountId),
        eq(events.galleryId, galleryId),
        gte(events.ts, since),
      ),
    )
    .groupBy(events.type);
  const stats: GalleryStats = { view: 0, play: 0, download: 0, favorite: 0 };
  for (const r of rows) stats[r.type] = r.n;
  return stats;
}

/** Events are deleted after this many days (D-134). */
export const EVENT_RETENTION_DAYS = 730;

/** Deletes events older than the retention period; returns how many. */
export async function cleanupOldEvents(db: Db, now = new Date()) {
  const cutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 86_400_000);
  const deleted = await db
    .delete(events)
    .where(lt(events.ts, cutoff))
    .returning({ id: events.id });
  return { deleted: deleted.length };
}
