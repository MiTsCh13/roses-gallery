import { describe, expect, it } from "vitest";

import { previewTiles } from "./design-preview";

describe("previewTiles", () => {
  it("uses placeholders for an empty gallery", () => {
    const tiles = previewTiles([]);
    expect(tiles).toHaveLength(8);
    expect(tiles.every((t) => !t.src)).toBe(true);
  });

  it("maps photos to thumbnails and videos to inert tiles", () => {
    const tiles = previewTiles([
      { id: "a", type: "photo" },
      { id: "b", type: "video" },
    ]);
    expect(tiles[0].src).toBe("/api/library/thumb/a");
    expect(tiles[1]).toMatchObject({
      id: "b",
      video: { posterUrl: "/api/library/thumb/b" },
    });
  });

  it("keeps real formats and skips photos that are still processing", () => {
    const tiles = previewTiles([
      {
        id: "a",
        type: "photo",
        width: 3000,
        height: 2000,
        processingStatus: "ready",
      },
      { id: "b", type: "photo", processingStatus: "processing" },
    ]);
    expect(tiles[0].aspect).toBeCloseTo(1.5);
    expect(tiles[1].src).toBeUndefined();
  });

  it("caps the number of tiles", () => {
    const many = Array.from({ length: 50 }, (_, n) => ({
      id: String(n),
      type: "photo",
    }));
    expect(previewTiles(many)).toHaveLength(24);
  });
});
