"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  GalleryView,
  type GalleryViewTile,
} from "@/components/gallery/gallery-view";
import { Button } from "@/components/ui/button";
import { COVER_STYLES, GRID_LAYOUTS, type ThemeConfig } from "@/lib/themes";

type ThemeOption = { id: string; name: string; config: ThemeConfig };

const FONTS = ["serif", "sans", "elegant"] as const;
const GAPS = ["small", "medium", "large"] as const;
const COLORS = ["background", "text", "accent", "muted"] as const;

const selectClass = "h-9 w-full rounded-md border bg-transparent px-3";

export function DesignEditor({
  galleryId,
  title,
  themes,
  initialThemeId,
  initialConfig,
  logoUrl,
  tiles,
  action,
  removeLogoAction,
}: {
  galleryId: string;
  title: string;
  themes: ThemeOption[];
  initialThemeId: string;
  initialConfig: ThemeConfig;
  logoUrl?: string;
  tiles: GalleryViewTile[];
  action: (formData: FormData) => void | Promise<void>;
  removeLogoAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useTranslations("Design");
  const [themeId, setThemeId] = useState(initialThemeId);
  const [config, setConfig] = useState(initialConfig);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  const pickTheme = (id: string) => {
    const theme = themes.find((x) => x.id === id);
    if (!theme) return;
    setThemeId(id);
    setConfig(theme.config);
  };
  const patch = <K extends keyof ThemeConfig>(
    key: K,
    value: Partial<ThemeConfig[K]>,
  ) => setConfig((c) => ({ ...c, [key]: { ...c[key], ...value } }));

  return (
    <div className="grid gap-8">
      <div className="space-y-8">
        <form action={action} className="space-y-5 text-sm">
          <input type="hidden" name="galleryId" value={galleryId} />
          <input type="hidden" name="themeId" value={themeId} />
          <input type="hidden" name="config" value={JSON.stringify(config)} />

          <label className="block space-y-1">
            <span>{t("theme")}</span>
            <select
              value={themeId}
              onChange={(e) => pickTheme(e.target.value)}
              className={selectClass}
            >
              {themes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="font-medium">{t("font")}</legend>
            {(["heading", "body"] as const).map((k) => (
              <label key={k} className="block space-y-1">
                <span>
                  {k === "heading" ? t("fontHeading") : t("fontBody")}
                </span>
                <select
                  value={config.fonts[k]}
                  onChange={(e) =>
                    patch("fonts", { [k]: e.target.value } as never)
                  }
                  className={selectClass}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {t(`fontOption.${f}`)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="font-medium">{t("colors")}</legend>
            {COLORS.map((k) => (
              <label
                key={k}
                className="flex items-center justify-between gap-3"
              >
                <span>{t(`color.${k}`)}</span>
                <input
                  type="color"
                  value={config.colors[k]}
                  onChange={(e) => patch("colors", { [k]: e.target.value })}
                />
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="font-medium">{t("grid")}</legend>
            <label className="block space-y-1">
              <span>{t("layout")}</span>
              <select
                value={config.grid.layout}
                onChange={(e) =>
                  patch("grid", { layout: e.target.value as never })
                }
                className={selectClass}
              >
                {GRID_LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {t(`layoutOption.${l}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span>{t("gap")}</span>
              <select
                value={config.grid.gap}
                onChange={(e) =>
                  patch("grid", { gap: e.target.value as never })
                }
                className={selectClass}
              >
                {GAPS.map((g) => (
                  <option key={g} value={g}>
                    {t(`gapOption.${g}`)}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <label className="block space-y-1">
            <span>{t("cover")}</span>
            <select
              value={config.cover.style}
              onChange={(e) =>
                patch("cover", { style: e.target.value as never })
              }
              className={selectClass}
            >
              {COVER_STYLES.map((c) => (
                <option key={c} value={c}>
                  {t(`coverOption.${c}`)}
                </option>
              ))}
            </select>
          </label>

          <Button type="submit">{t("save")}</Button>
        </form>

        <section aria-label={t("logo")} className="space-y-2 text-sm">
          <h2 className="font-medium">{t("logo")}</h2>
          <form
            method="post"
            action="/api/branding/logo"
            encType="multipart/form-data"
            className="space-y-2"
          >
            <input type="hidden" name="galleryId" value={galleryId} />
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              aria-label={t("logoFile")}
              required
            />
            <p className="text-muted-foreground">{t("logoHint")}</p>
            <Button type="submit" variant="outline">
              {t("logoUpload")}
            </Button>
          </form>
          {logoUrl && (
            <form action={removeLogoAction}>
              <input type="hidden" name="galleryId" value={galleryId} />
              <Button type="submit" variant="ghost">
                {t("logoRemove")}
              </Button>
            </form>
          )}
        </section>
      </div>

      <section aria-label={t("preview")} className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
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
              subtitle={t("previewSubtitle")}
              logoUrl={logoUrl}
              tiles={tiles}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
