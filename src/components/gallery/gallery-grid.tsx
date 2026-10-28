"use client";

import { useState } from "react";

import type { GRID_LAYOUTS } from "@/lib/themes";
import { Lightbox } from "./lightbox";

export type GalleryViewTile = {
  id: string;
  src?: string;
  srcSet?: string;
  alt?: string;
  /** Download links permitted for this photo (F-SEC-02). */
  downloads?: { web?: string; original?: string };
};

export function GalleryGrid({
  layout,
  tiles,
}: {
  layout: (typeof GRID_LAYOUTS)[number];
  tiles: GalleryViewTile[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  // only real photos open in the lightbox; placeholders stay inert
  const photos = tiles.filter((t) => t.src);

  const tile = (t: GalleryViewTile, className: string) => {
    const index = photos.indexOf(t);
    return (
      <div
        key={t.id}
        data-testid="gallery-tile"
        className={`overflow-hidden ${className}`}
        style={{ background: "var(--g-muted)", opacity: t.src ? 1 : 0.25 }}
      >
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
