import type { GalleryViewTile } from "@/components/gallery/gallery-view";

const PLACEHOLDERS = 8;
const MAX_TILES = 24;

/** Live design preview: real photos of the gallery, placeholders when empty. */
export function previewTiles(
  media: { id: string; type: string }[],
): GalleryViewTile[] {
  if (media.length === 0) {
    return Array.from({ length: PLACEHOLDERS }, (_, n) => ({
      id: `placeholder-${n}`,
    }));
  }
  return media
    .slice(0, MAX_TILES)
    .map((m) =>
      m.type === "photo"
        ? { id: m.id, src: `/api/library/thumb/${m.id}`, alt: "" }
        : { id: m.id },
    );
}
