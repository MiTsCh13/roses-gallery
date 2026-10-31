// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import messages from "../../../messages/de.json";
import { SYSTEM_THEMES } from "@/lib/themes";
import { GalleryGrid, type GalleryViewTile } from "./gallery-grid";

const tiles = [
  { id: "a", src: "https://x.test/a.webp", alt: "Foto 1" },
  { id: "p" },
  { id: "b", src: "https://x.test/b.webp", alt: "Foto 2" },
  { id: "c", src: "https://x.test/c.webp", alt: "Foto 3" },
];

function renderGrid(list: GalleryViewTile[] = tiles) {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <GalleryGrid layout={SYSTEM_THEMES[0].config.grid.layout} tiles={list} />
    </NextIntlClientProvider>,
  );
}
const shown = () => screen.getByTestId("lightbox-image").getAttribute("src");

afterEach(cleanup);

describe("Lightbox", () => {
  it("is closed by default and placeholders are not clickable", () => {
    renderGrid();
    expect(screen.queryByTestId("lightbox")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("opens on click, skips placeholders and wraps with the keyboard", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Foto 2" }));
    expect(shown()).toBe("https://x.test/b.webp");
    expect(screen.getByText("2 von 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(shown()).toBe("https://x.test/c.webp");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(shown()).toBe("https://x.test/a.webp");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(shown()).toBe("https://x.test/c.webp");
  });

  it("navigates with buttons and swipes, closes with Escape", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Foto 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Nächstes Foto" }));
    expect(shown()).toBe("https://x.test/b.webp");

    const box = screen.getByTestId("lightbox");
    fireEvent.touchStart(box, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(box, { changedTouches: [{ clientX: 100 }] });
    expect(shown()).toBe("https://x.test/c.webp");
    fireEvent.touchStart(box, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(box, { changedTouches: [{ clientX: 130 }] });
    expect(shown()).toBe("https://x.test/c.webp"); // too short to count
    fireEvent.touchStart(box, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(box, { changedTouches: [{ clientX: 200 }] });
    expect(shown()).toBe("https://x.test/b.webp");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("lightbox")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("offers only the downloads the photo permits", () => {
    renderGrid([
      {
        id: "a",
        src: "https://x.test/a.webp",
        alt: "Foto 1",
        downloads: { web: "/dl/a?size=web", original: "/dl/a?size=original" },
      },
      { id: "b", src: "https://x.test/b.webp", alt: "Foto 2" },
    ] as typeof tiles);
    fireEvent.click(screen.getByRole("button", { name: "Foto 1" }));
    expect(
      screen.getByRole("link", { name: "Herunterladen" }).getAttribute("href"),
    ).toBe("/dl/a?size=web");
    expect(
      screen
        .getByRole("link", { name: "Original herunterladen" })
        .getAttribute("href"),
    ).toBe("/dl/a?size=original");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("opens a video tile in the player and swipes on to the next photo", () => {
    renderGrid([
      { id: "a", src: "https://x.test/a.webp", alt: "Foto 1" },
      {
        id: "v",
        video: {
          title: "Film 1",
          playUrl: "https://v.test/e/1",
          durationS: 65,
        },
      },
    ]);
    // the embed is not loaded before the visitor opens the tile
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Film 1" }));
    expect(screen.getByTestId("lightbox-video")).toBeTruthy();
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://v.test/e/1",
    );
    expect(screen.queryByTestId("lightbox-image")).toBeNull();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(shown()).toBe("https://x.test/a.webp");
    expect(screen.queryByTestId("lightbox-video")).toBeNull();
  });
});
