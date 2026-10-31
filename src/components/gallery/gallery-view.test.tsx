import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SYSTEM_THEMES } from "@/lib/themes";
import { GalleryView } from "./gallery-view";

const tiles = [{ id: "a" }, { id: "b", src: "https://x.test/b.jpg", alt: "B" }];

describe("GalleryView", () => {
  it("applies the theme as CSS variables and exposes its layout", () => {
    const theme = SYSTEM_THEMES[1];
    const html = renderToStaticMarkup(
      <GalleryView config={theme.config} title="Anna & Ben" tiles={tiles} />,
    );
    expect(html).toContain("--g-bg:#f7f7f5");
    expect(html).toContain('data-layout="masonry"');
    expect(html).toContain('data-cover="split"');
    expect(html).toContain("Anna &amp; Ben");
  });

  it("renders every tile and the logo only when given", () => {
    const config = SYSTEM_THEMES[0].config;
    const without = renderToStaticMarkup(
      <GalleryView config={config} title="T" tiles={tiles} />,
    );
    expect(without.match(/data-testid="gallery-tile"/g)).toHaveLength(2);
    expect(without).not.toContain("gallery-logo");

    const withLogo = renderToStaticMarkup(
      <GalleryView
        config={config}
        title="T"
        logoUrl="https://x.test/logo.png"
        logoAlt="Studio"
        tiles={tiles}
      />,
    );
    expect(withLogo).toContain('data-testid="gallery-logo"');
    expect(withLogo).toContain('alt="Studio"');
  });

  it("renders all cover styles and grid layouts", () => {
    for (const theme of SYSTEM_THEMES) {
      const html = renderToStaticMarkup(
        <GalleryView config={theme.config} title="T" tiles={tiles} />,
      );
      expect(html).toContain(`data-cover="${theme.config.cover.style}"`);
    }
  });

  it("renders responsive, lazy-loaded photos with a srcset", () => {
    const html = renderToStaticMarkup(
      <GalleryView
        config={SYSTEM_THEMES[0].config}
        title="T"
        tiles={[
          {
            id: "p",
            src: "https://x.test/1200.webp",
            srcSet:
              "https://x.test/400.webp 400w, https://x.test/1200.webp 1200w",
          },
        ]}
      />,
    );
    expect(html).toContain('srcSet="https://x.test/400.webp 400w');
    expect(html).toContain('loading="lazy"');
  });

  it("loads the cover with srcset and high fetch priority (LCP)", () => {
    const html = renderToStaticMarkup(
      <GalleryView
        config={SYSTEM_THEMES[0].config}
        title="T"
        coverUrl="https://x.test/2400.webp"
        coverSrcSet="https://x.test/400.webp 400w, https://x.test/2400.webp 2400w"
        tiles={[]}
      />,
    );
    expect(html).toContain('srcSet="https://x.test/400.webp 400w');
    expect(html).toContain('sizes="100vw"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).not.toContain('loading="lazy"');
  });

  it("renders photos and videos in one grid, videos as play tiles", () => {
    const html = renderToStaticMarkup(
      <GalleryView
        config={SYSTEM_THEMES[0].config}
        title="T"
        tiles={[
          { id: "p", src: "https://x.test/p.jpg", alt: "Foto 1" },
          {
            id: "v",
            video: {
              title: "Film 1",
              playUrl: "https://v.test/e/1",
              durationS: 95,
            },
          },
        ]}
      />,
    );
    expect(html.match(/data-testid="gallery-tile"/g)).toHaveLength(2);
    expect(html.match(/data-testid="video-tile"/g)).toHaveLength(1);
    expect(html).toContain("1:35");
    // the player only loads after the visitor opens the tile
    expect(html).not.toContain("https://v.test/e/1");
  });
});
