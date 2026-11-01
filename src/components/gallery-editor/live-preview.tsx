"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  GalleryView,
  type GalleryViewTile,
} from "@/components/gallery/gallery-view";
import { Button } from "@/components/ui/button";
import { useEditorState } from "./editor-state";

/** The gallery as visitors see it, following every unsaved edit. */
export function LivePreview({
  logoUrl,
  coverUrl,
  tiles,
  openHref,
}: {
  logoUrl?: string;
  coverUrl?: string;
  tiles: GalleryViewTile[];
  /** Public URL, opened in a new tab. */
  openHref: string;
}) {
  const t = useTranslations("Design");
  const { title, description, config } = useEditorState();
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  return (
    <section aria-label={t("preview")} className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium">{t("preview")}</h2>
        {(["desktop", "mobile"] as const).map((v) => (
          <Button
            key={v}
            type="button"
            size="sm"
            variant={viewport === v ? "default" : "outline"}
            aria-pressed={viewport === v}
            onClick={() => setViewport(v)}
          >
            {t(v)}
          </Button>
        ))}
        <a
          href={openHref}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-sm underline"
        >
          {t("openPreview")}
        </a>
      </div>
      <div className="overflow-auto rounded-md border bg-muted/30 p-2">
        <div
          data-testid="design-preview"
          data-viewport={viewport}
          className="mx-auto overflow-hidden rounded-sm border"
          style={{ width: viewport === "mobile" ? 390 : "100%" }}
        >
          <GalleryView
            config={config}
            title={title}
            subtitle={description || undefined}
            logoUrl={logoUrl}
            coverUrl={coverUrl}
            tiles={tiles}
          />
        </div>
      </div>
    </section>
  );
}
