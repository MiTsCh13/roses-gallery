import { and, asc, eq, inArray } from "drizzle-orm";

import type { Db } from "@/db";
import { favoriteLists, favorites, media, visitors } from "@/db/schema";
import { mediaNumbers } from "@/lib/favorites";

// Dashboard view of a gallery's favorite lists (F-INT-01): what each visitor
// marked, as the photo/video numbers the visitor sees. Scoped to the account.

type Deps = { db: Db; accountId: string };

export type FavoriteListSummary = {
  id: string;
  name: string;
  email: string | null;
  createdAt: Date;
  photos: number[];
  videos: number[];
};

/** Non-empty favorite lists of one gallery, oldest first. */
export async function galleryFavorites(
  deps: Deps,
  galleryId: string,
): Promise<FavoriteListSummary[]> {
  const gallery = { id: galleryId, accountId: deps.accountId };
  const lists = await deps.db
    .select({
      id: favoriteLists.id,
      name: favoriteLists.name,
      createdAt: favoriteLists.createdAt,
      email: visitors.email,
    })
    .from(favoriteLists)
    .innerJoin(visitors, eq(visitors.id, favoriteLists.visitorId))
    .where(
      and(
        eq(favoriteLists.accountId, deps.accountId),
        eq(visitors.accountId, deps.accountId),
        eq(visitors.galleryId, galleryId),
      ),
    )
    .orderBy(asc(favoriteLists.createdAt), asc(favoriteLists.id));
  if (lists.length === 0) return [];

  const rows = await deps.db
    .select({ listId: favorites.listId, mediaId: media.id, type: media.type })
    .from(favorites)
    .innerJoin(media, eq(media.id, favorites.mediaId))
    .where(
      and(
        eq(favorites.accountId, deps.accountId),
        eq(media.accountId, deps.accountId),
        inArray(
          favorites.listId,
          lists.map((l) => l.id),
        ),
      ),
    );
  // media no longer (or not yet) shown in the gallery have no number: skipped
  const numberOf = await mediaNumbers(deps.db, gallery);
  const byList = new Map(
    lists.map((l) => [
      l.id,
      { ...l, photos: [] as number[], videos: [] as number[] },
    ]),
  );
  for (const r of rows) {
    const n = numberOf.get(r.mediaId);
    const list = byList.get(r.listId);
    if (!n || !list) continue;
    (r.type === "photo" ? list.photos : list.videos).push(n);
  }
  return [...byList.values()]
    .map((l) => ({
      ...l,
      photos: l.photos.sort((a, b) => a - b),
      videos: l.videos.sort((a, b) => a - b),
    }))
    .filter((l) => l.photos.length + l.videos.length > 0);
}

export type CsvLabels = {
  list: string;
  visitor: string;
  type: string;
  number: string;
  photo: string;
  video: string;
  guest: string;
};

// Visitors choose list names: neutralise spreadsheet formulas (CSV injection)
// and quote every cell.
function cell(value: string | number) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * One row per favorite, semicolon-separated with BOM so that Excel in the
 * DACH region opens it directly.
 */
export function favoritesCsv(lists: FavoriteListSummary[], labels: CsvLabels) {
  const lines = [[labels.list, labels.visitor, labels.type, labels.number]];
  for (const l of lists) {
    const who = l.email ?? labels.guest;
    for (const n of l.photos)
      lines.push([l.name, who, labels.photo, String(n)]);
    for (const n of l.videos)
      lines.push([l.name, who, labels.video, String(n)]);
  }
  return `﻿${lines.map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}
