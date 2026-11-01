"use client";

import { useState } from "react";

import type { GRID_LAYOUTS } from "@/lib/themes";
import {
  FavoriteButton,
  FavoritesFilter,
  FavoritesFilterEmpty,
  useFavorites,
} from "./favorites";
import { Lightbox } from "./lightbox";

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export type GalleryViewVideo = {
  title: string;
  playUrl?: string;
  hlsUrl?: string;
  /** Poster frame; the gradient placeholder is shown without or if it fails. */
  posterUrl?: string;
  durationS?: number | null;
};

export type GalleryViewTile = {
  id: string;
  src?: string;
  srcSet?: string;
  alt?: string;
  /** Download links permitted for this photo (F-SEC-02). */
  downloads?: { web?: string; original?: string };
  /** Set for video tiles: a play tile that opens the player in the lightbox. */
  video?: GalleryViewVideo;
};

export function GalleryGrid({
  layout,
  tiles: allTiles,
}: {
  layout: (typeof GRID_LAYOUTS)[number];
  tiles: GalleryViewTile[];
}) {
  const fav = useFavorites();
  const [open, setOpen] = useState<number | null>(null);
  const [brokenPosters, setBrokenPosters] = useState<Set<string>>(new Set());
  const filtering = fav?.onlyFavorites === true;
  const shown = filtering
    ? allTiles.filter((x) => fav!.isFavorite(x.id))
    : allTiles;
  // photos and videos open in the lightbox; placeholders stay inert
  const photos = shown.filter((x) => x.src || x.video);
  const tiles = shown;

  const tile = (t: GalleryViewTile, className: string) => {
    const index = photos.indexOf(t);
    return (
      <div
        key={t.id}
        data-testid="gallery-tile"
        className={`relative overflow-hidden ${className}`}
        style={{
          background: "var(--g-muted)",
          opacity: t.src || t.video ? 1 : 0.25,
        }}
      >
        {t.video && (
          <button
            type="button"
            data-testid="video-tile"
            onClick={() => setOpen(index)}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1"
            style={{
              background:
                "linear-gradient(135deg, var(--g-accent), var(--g-muted) 120%)",
              color: "var(--g-bg)",
            }}
            aria-label={t.video.title}
          >
            {t.video.posterUrl && !brokenPosters.has(t.id) && (
              // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs bypass next/image
              <img
                src={t.video.posterUrl}
                alt=""
                loading="lazy"
                decoding="async"
                data-testid="video-poster"
                onError={() => setBrokenPosters((s) => new Set(s).add(t.id))}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span
              className="relative rounded-full bg-black/50 px-4 py-2 text-3xl text-white"
              aria-hidden
            >
              ▶
            </span>
            {t.video.durationS != null && (
              <span className="relative rounded bg-black/50 px-1 text-xs text-white">
                {formatDuration(t.video.durationS)}
              </span>
            )}
          </button>
        )}
        {t.src && (
          <button
            type="button"
            onClick={() => setOpen(index)}
            className="block h-full w-full cursor-zoom-in"
            aria-label={t.alt || undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs bypass next/image */}
            <img
              src={t.src}
              srcSet={t.srcSet}
              sizes="(min-width: 42rem) 25vw, 50vw"
              loading="lazy"
              decoding="async"
              alt={t.alt ?? ""}
              className="h-full w-full object-cover"
            />
          </button>
        )}
        {(t.src || t.video) && (
          <FavoriteButton
            mediaId={t.id}
            className="absolute right-2 bottom-2 px-2 py-1 text-base"
          />
        )}
      </div>
    );
  };

  let grid;
  if (layout === "masonry") {
    grid = (
      <div
        className="columns-2 @2xl:columns-4"
        style={{ columnGap: "var(--g-gap)" }}
      >
        {tiles.map((t, i) => (
          <div
            key={t.id}
            style={{ marginBottom: "var(--g-gap)", breakInside: "avoid" }}
          >
            {tile(t, i % 3 === 0 ? "aspect-[3/4]" : "aspect-[4/3]")}
          </div>
        ))}
      </div>
    );
  } else if (layout === "rows") {
    grid = (
      <div className="flex flex-col" style={{ gap: "var(--g-gap)" }}>
        {tiles.map((t) => tile(t, "aspect-[16/9] w-full"))}
      </div>
    );
  } else {
    grid = (
      <div
        className="grid grid-cols-2 @2xl:grid-cols-4"
        style={{ gap: "var(--g-gap)" }}
      >
        {tiles.map((t) => tile(t, "aspect-square"))}
      </div>
    );
  }

  return (
    <>
      <FavoritesFilter />
      {filtering && shown.length === 0 && <FavoritesFilterEmpty />}
      {grid}
      {open !== null && (
        <Lightbox
          photos={photos}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
