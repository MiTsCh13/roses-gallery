import type { GalleryViewTile } from "@/components/gallery/gallery-view";

const PLACEHOLDERS = 8;
const MAX_TILES = 24;

/** Live design preview: real photos of the gallery, placeholders when empty. */
export function previewTiles(
  media: {
    id: string;
    type: string;
    processingStatus?: string;
    width?: number | null;
    height?: number | null;
  }[],
): GalleryViewTile[] {
  if (media.length === 0) {
    return Array.from({ length: PLACEHOLDERS }, (_, n) => ({
      id: `placeholder-${n}`,
    }));
  }
  return media.slice(0, MAX_TILES).map((m) => {
    const aspect = m.width && m.height ? m.width / m.height : undefined;
    // photos still being processed have no thumbnail yet: inert placeholder
    return m.type === "photo" &&
      m.processingStatus !== "processing" &&
      m.processingStatus !== "pending"
      ? { id: m.id, src: `/api/library/thumb/${m.id}`, alt: "", aspect }
      : { id: m.id, aspect };
  });
}
