import type { CSSProperties } from "react";

import { GalleryGrid } from "./gallery-grid";

import { themeCssVars, type ThemeConfig } from "@/lib/themes";
import type { GalleryViewTile } from "./gallery-grid";

export type { GalleryViewTile };
export type GalleryViewSet = {
  id: string;
  title: string;
  tiles: GalleryViewTile[];
};

export type GalleryViewProps = {
  config: ThemeConfig;
  title: string;
  subtitle?: string;
  logoUrl?: string;
  logoAlt?: string;
  coverUrl?: string;
  sets: GalleryViewSet[];
};

/**
 * Themed gallery page. Pure and responsive via container queries, so the
 * editor preview (a narrow or wide container) and the real view (M7) render
 * the very same markup.
 */
export function GalleryView({
  config,
  title,
  subtitle,
  logoUrl,
  logoAlt = "",
  coverUrl,
  sets,
}: GalleryViewProps) {
  return (
    <div
      data-testid="gallery-view"
      data-cover={config.cover.style}
      data-layout={config.grid.layout}
      className="@container min-h-full"
      style={{
        ...(themeCssVars(config) as CSSProperties),
        background: "var(--g-bg)",
        color: "var(--g-text)",
        fontFamily: "var(--g-font-body)",
      }}
    >
      <GalleryCover
        style={config.cover.style}
        title={title}
        subtitle={subtitle}
        logoUrl={logoUrl}
        logoAlt={logoAlt}
        coverUrl={coverUrl}
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 @lg:px-8">
        {sets.map((set) => (
          <section key={set.id} aria-label={set.title} className="space-y-3">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--g-font-heading)" }}
            >
              {set.title}
            </h2>
            <GalleryGrid layout={config.grid.layout} tiles={set.tiles} />
          </section>
        ))}
      </div>
    </div>
  );
}

export function GalleryCover({
  style,
  title,
  subtitle,
  logoUrl,
  logoAlt,
  coverUrl,
}: {
  style: ThemeConfig["cover"]["style"];
  title: string;
  subtitle?: string;
  logoUrl?: string;
  logoAlt?: string;
  coverUrl?: string;
}) {
  const image = coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs bypass next/image
    <img src={coverUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <div
      aria-hidden
      className="h-full w-full"
      style={{
        background:
          "linear-gradient(135deg, var(--g-accent), var(--g-muted) 120%)",
        opacity: 0.55,
      }}
    />
  );
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs bypass next/image
    <img
      src={logoUrl}
      alt={logoAlt}
      data-testid="gallery-logo"
      className="h-10 w-auto max-w-40 object-contain"
    />
  ) : null;
  const heading = (
    <>
      <h1
        className="text-3xl @lg:text-5xl"
        style={{ fontFamily: "var(--g-font-heading)" }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-sm" style={{ color: "var(--g-muted)" }}>
          {subtitle}
        </p>
      )}
    </>
  );

  if (style === "full") {
    return (
      <header className="relative h-72 @lg:h-96">
        <div className="absolute inset-0">{image}</div>
        <div className="absolute inset-0 flex flex-col justify-between bg-black/30 p-4 text-white @lg:p-8">
          <div>{logo}</div>
          <div>{heading}</div>
        </div>
      </header>
    );
  }
  if (style === "split") {
    return (
      <header className="grid @lg:grid-cols-2">
        <div className="flex flex-col justify-between gap-8 p-4 @lg:p-8">
          <div>{logo}</div>
          <div>{heading}</div>
        </div>
        <div className="h-56 @lg:h-96">{image}</div>
      </header>
    );
  }
  return (
    <header className="space-y-4 px-4 py-10 text-center @lg:px-8 @lg:py-16">
      <div className="flex justify-center">{logo}</div>
      <div>{heading}</div>
    </header>
  );
}
