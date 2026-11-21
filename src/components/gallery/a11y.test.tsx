// @vitest-environment jsdom
import axe from "axe-core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import messages from "../../../messages/de.json";
import { SYSTEM_THEMES } from "@/lib/themes";
import { GalleryGrid } from "./gallery-grid";
import { GalleryView } from "./gallery-view";

const tiles = [
  { id: "a", src: "https://x.test/a.jpg", alt: "Foto 1" },
  { id: "b", src: "https://x.test/b.jpg", alt: "Foto 2" },
  {
    id: "v1",
    video: { title: "Film 1", playUrl: "https://v.test/e/1", durationS: 95 },
  },
];

// jsdom has no layout engine, so color-contrast is covered by contrast.test.ts
async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => v.id);
}

afterEach(cleanup);

describe("gallery markup (axe)", () => {
  for (const theme of SYSTEM_THEMES) {
    it(`${theme.name}: photos, cover and videos have no WCAG violations`, async () => {
      const { container } = render(
        <NextIntlClientProvider locale="de" messages={messages}>
          <main>
            <GalleryView
              config={theme.config}
              title="Anna & Ben"
              subtitle="Hochzeit"
              logoUrl="https://x.test/logo.png"
              logoAlt="Studio"
              coverUrl="https://x.test/cover.jpg"
              tiles={tiles}
            />
          </main>
        </NextIntlClientProvider>,
      );
      expect(await violations(container)).toEqual([]);
    });
  }

  it("open lightbox has no WCAG violations", async () => {
    render(
      <NextIntlClientProvider locale="de" messages={messages}>
        <main>
          <GalleryGrid layout="uniform" tiles={tiles} />
        </main>
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Foto 1" }));
    expect(screen.getByTestId("lightbox")).toBeTruthy();
    expect(await violations(document.body)).toEqual([]);
  });
});
