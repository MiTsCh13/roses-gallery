// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import messages from "../../../messages/de.json";
import { SYSTEM_THEMES } from "@/lib/themes";
import { GalleryGrid } from "./gallery-grid";

const tiles = [
  { id: "a", src: "https://x.test/a.webp", alt: "Foto 1" },
  { id: "p" },
  { id: "b", src: "https://x.test/b.webp", alt: "Foto 2" },
  { id: "c", src: "https://x.test/c.webp", alt: "Foto 3" },
];

function renderGrid() {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <GalleryGrid layout={SYSTEM_THEMES[0].config.grid.layout} tiles={tiles} />
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
});
