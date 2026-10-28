import { and, asc, eq, isNull, or } from "drizzle-orm";

import type { Db } from "@/db";
import { accounts, galleries, sets, themes } from "@/db/schema";
import { LOGO_URL_TTL_SECONDS } from "@/lib/branding";
import type { Storage } from "@/lib/storage/types";
import {
  DEFAULT_THEME,
  themeConfigSchema,
  type ThemeConfig,
} from "@/lib/themes";

type Deps = { db: Db; storage: Storage; now?: Date };

export type PublicGallery = {
  id: string;
  accountId: string;
  title: string;
  eventDate: Date | null;
  config: ThemeConfig;
  logoUrl: string | null;
  sets: { id: string; title: string; type: "photo" | "video" }[];
};

function parseConfig(raw: unknown): ThemeConfig | null {
  const r = themeConfigSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * Resolves a gallery by its public slug. The slug is the only tenant-free
 * lookup in the app; everything else is read with the owning accountId taken
 * from the found row. Returns null unless the gallery is published and not
 * expired, so drafts, expired and archived galleries are indistinguishable
 * from missing ones.
 */
export async function loadPublicGallery(
  deps: Deps,
  slug: string,
): Promise<PublicGallery | null> {
  const now = deps.now ?? new Date();
  const [gallery] = await deps.db
    .select()
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);
  if (!gallery || gallery.status !== "published") return null;
  if (gallery.expiresAt && gallery.expiresAt <= now) return null;

  const accountId = gallery.accountId;
  // a theme is a system theme (accountId null) or one of this account
  const [theme] = gallery.themeId
    ? await deps.db
        .select()
        .from(themes)
        .where(
          and(
            eq(themes.id, gallery.themeId),
            or(isNull(themes.accountId), eq(themes.accountId, accountId)),
          ),
        )
        .limit(1)
    : [];
  const config =
    parseConfig(gallery.themeOverrides) ??
    parseConfig(theme?.config) ??
    DEFAULT_THEME.config;

  const [account] = await deps.db
    .select({ branding: accounts.branding })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  const logoKey = account?.branding.logoKey;
  const logoUrl =
    typeof logoKey === "string"
      ? await deps.storage.signGet(logoKey, LOGO_URL_TTL_SECONDS)
      : null;

  const rows = await deps.db
    .select({ id: sets.id, title: sets.title, type: sets.type })
    .from(sets)
    .where(and(eq(sets.accountId, accountId), eq(sets.galleryId, gallery.id)))
    .orderBy(asc(sets.position));

  return {
    id: gallery.id,
    accountId,
    title: gallery.title,
    eventDate: gallery.eventDate,
    config,
    logoUrl,
    sets: rows,
  };
}
