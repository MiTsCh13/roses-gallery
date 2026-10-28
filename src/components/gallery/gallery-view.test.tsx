import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SYSTEM_THEMES } from "@/lib/themes";
import { GalleryView } from "./gallery-view";

const sets = [
  {
    id: "s1",
    title: "Trauung",
    tiles: [{ id: "a" }, { id: "b", src: "https://x.test/b.jpg", alt: "B" }],
  },
];

describe("GalleryView", () => {
  it("applies the theme as CSS variables and exposes its layout", () => {
    const theme = SYSTEM_THEMES[1];
    const html = renderToStaticMarkup(
      <GalleryView config={theme.config} title="Anna & Ben" sets={sets} />,
    );
    expect(html).toContain("--g-bg:#f7f7f5");
    expect(html).toContain('data-layout="masonry"');
    expect(html).toContain('data-cover="split"');
    expect(html).toContain("Anna &amp; Ben");
    expect(html).toContain("Trauung");
  });

  it("renders every tile and the logo only when given", () => {
    const config = SYSTEM_THEMES[0].config;
    const without = renderToStaticMarkup(
      <GalleryView config={config} title="T" sets={sets} />,
    );
    expect(without.match(/data-testid="gallery-tile"/g)).toHaveLength(2);
    expect(without).not.toContain("gallery-logo");

    const withLogo = renderToStaticMarkup(
      <GalleryView
        config={config}
        title="T"
        logoUrl="https://x.test/logo.png"
        logoAlt="Studio"
        sets={sets}
      />,
    );
    expect(withLogo).toContain('data-testid="gallery-logo"');
    expect(withLogo).toContain('alt="Studio"');
  });

  it("renders all cover styles and grid layouts", () => {
    for (const theme of SYSTEM_THEMES) {
      const html = renderToStaticMarkup(
        <GalleryView config={theme.config} title="T" sets={sets} />,
      );
      expect(html).toContain(`data-cover="${theme.config.cover.style}"`);
    }
  });

  it("renders responsive, lazy-loaded photos with a srcset", () => {
    const html = renderToStaticMarkup(
      <GalleryView
        config={SYSTEM_THEMES[0].config}
        title="T"
        sets={[
          {
            id: "s",
            title: "S",
            tiles: [
              {
                id: "p",
                src: "https://x.test/1200.webp",
                srcSet:
                  "https://x.test/400.webp 400w, https://x.test/1200.webp 1200w",
              },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain('srcSet="https://x.test/400.webp 400w');
    expect(html).toContain('loading="lazy"');
  });
});
