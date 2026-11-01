"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { COVER_STYLES, GRID_LAYOUTS } from "@/lib/themes";
import { useEditorState } from "./editor-state";

const FONTS = ["serif", "sans", "elegant"] as const;
const GAPS = ["small", "medium", "large"] as const;
const COLORS = ["background", "text", "accent", "muted"] as const;

const selectClass = "h-9 w-full rounded-md border bg-transparent px-3";

/**
 * Design controls. They belong to the main form (`form` attribute), so the one
 * Save button stores them together with the general settings; the preview on
 * the right follows each change.
 */
export function DesignFields({
  form,
  galleryId,
  logoUrl,
  removeLogoAction,
}: {
  form: string;
  galleryId: string;
  logoUrl?: string;
  removeLogoAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useTranslations("Design");
  const { themeId, config, themes, pickTheme, setConfig } = useEditorState();
  const patch = <K extends keyof typeof config>(
    key: K,
    value: Partial<(typeof config)[K]>,
  ) => setConfig((c) => ({ ...c, [key]: { ...c[key], ...value } }));

  return (
    <div className="space-y-8">
      <div className="space-y-5 text-sm">
        <input type="hidden" form={form} name="themeId" value={themeId} />
        <input
          type="hidden"
          form={form}
          name="config"
          value={JSON.stringify(config)}
        />
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
              <span>{k === "heading" ? t("fontHeading") : t("fontBody")}</span>
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
            <label key={k} className="flex items-center justify-between gap-3">
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
              onChange={(e) => patch("grid", { gap: e.target.value as never })}
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
            onChange={(e) => patch("cover", { style: e.target.value as never })}
            className={selectClass}
          >
            {COVER_STYLES.map((c) => (
              <option key={c} value={c}>
                {t(`coverOption.${c}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

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
  );
}
