"use client";

import { useState } from "react";

import type { GRID_LAYOUTS } from "@/lib/themes";
import { FavoriteButton } from "./favorites";
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
  durationS?: number | null;
};

export type GalleryViewTile = {
  id: string;
  src?: string;
  srcSet?: string;
  alt?: string;
  /** Download links permitted for this photo (F-SEC-02). */
  downloads?: { web?: string; original?: string };
  /** Story image URL (F-INT-02); only set when web downloads are allowed. */
  story?: string;
  /** Set for video tiles: a play tile that opens the player in the lightbox. */
  video?: GalleryViewVideo;
};

export function GalleryGrid({
  layout,
  tiles,
}: {
  layout: (typeof GRID_LAYOUTS)[number];
  tiles: GalleryViewTile[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  // photos and videos open in the lightbox; placeholders stay inert
  const photos = tiles.filter((t) => t.src || t.video);

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
            <span className="text-4xl" aria-hidden>
              ▶
            </span>
            {t.video.durationS != null && (
              <span className="text-xs">
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
        {t.src && !t.video && (
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
