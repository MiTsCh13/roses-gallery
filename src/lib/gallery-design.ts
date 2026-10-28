import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { themes } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { GalleryError } from "@/lib/galleries";
import {
  DEFAULT_THEME,
  themeConfigSchema,
  type ThemeConfig,
} from "@/lib/themes";

type Deps = { db: Db; accountId: string };

const saveDesignSchema = z.object({
  galleryId: z.uuid(),
  themeId: z.uuid(),
  config: themeConfigSchema,
});

function parseConfig(raw: unknown): ThemeConfig | null {
  const r = themeConfigSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** System themes plus the account's own themes, system first. */
export async function listThemes(deps: Deps) {
  const rows = await deps.db
    .select()
    .from(themes)
    .where(isNull(themes.accountId));
  const own = await tenantDb(deps.db, deps.accountId).themes.list();
  return [...rows, ...own].flatMap((t) => {
    const config = parseConfig(t.config);
    return config ? [{ id: t.id, name: t.name, config }] : [];
  });
}

/** The gallery's effective theme: overrides, else its theme, else default. */
export async function galleryDesign(deps: Deps, galleryId: string) {
  const gallery = await tenantDb(deps.db, deps.accountId).galleries.get(
    galleryId,
  );
  if (!gallery) throw new GalleryError("not_found", "Gallery not found.");
  const available = await listThemes(deps);
  const base =
    available.find((t) => t.id === gallery.themeId) ??
    available.find((t) => t.id === DEFAULT_THEME.id) ??
    DEFAULT_THEME;
  const config = parseConfig(gallery.themeOverrides) ?? base.config;
  return { themeId: base.id, config, themes: available };
}

/**
 * Saves the chosen base theme and the (possibly customised) config. A config
 * identical to the theme's own is stored as no override.
 */
export async function saveGalleryDesign(deps: Deps, input: unknown) {
  const data = saveDesignSchema.parse(input);
  const t = tenantDb(deps.db, deps.accountId);
  if (!(await t.galleries.get(data.galleryId)))
    throw new GalleryError("not_found", "Gallery not found.");
  // system theme first, else one of the account's own (tenant-scoped)
  const [theme] = await deps.db
    .select()
    .from(themes)
    .where(and(eq(themes.id, data.themeId), isNull(themes.accountId)))
    .limit(1);
  const own = theme ? undefined : await t.themes.get(data.themeId);
  const base = theme ?? own;
  if (!base) throw new GalleryError("not_found", "Theme not found.");
  const same =
    JSON.stringify(parseConfig(base.config)) === JSON.stringify(data.config);
  await t.galleries.update(data.galleryId, {
    themeId: base.id,
    themeOverrides: same ? null : data.config,
  });
}
