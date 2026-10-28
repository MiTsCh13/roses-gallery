import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";

import type { Db } from "@/db";
import { accounts, media } from "@/db/schema";
import type { PhotoVariants } from "@/lib/photos";
import type { Storage } from "@/lib/storage/types";

// Watermark (F-SEC-03): the account logo is stamped onto web sizes when the
// gallery enables it. Originals are never touched. Stamped copies are created
// lazily and cached in storage under a key containing the settings signature,
// so changing the logo or settings never serves a stale copy.

export const WATERMARK_POSITIONS = [
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export const watermarkConfigSchema = z.object({
  position: z.enum(WATERMARK_POSITIONS),
  /** Percent, 5–100. */
  opacity: z.coerce.number().int().min(5).max(100),
  /** Logo width as percent of the image width, 5–60. */
  scale: z.coerce.number().int().min(5).max(60),
});
export type WatermarkConfig = z.infer<typeof watermarkConfigSchema>;

export const DEFAULT_WATERMARK: WatermarkConfig = {
  position: "bottom-right",
  opacity: 60,
  scale: 20,
};

export function readWatermarkConfig(
  branding: Record<string, unknown>,
): WatermarkConfig {
  const r = watermarkConfigSchema.safeParse(branding.watermark);
  return r.success ? r.data : DEFAULT_WATERMARK;
}

export async function saveWatermarkConfig(
  deps: { db: Db; accountId: string },
  input: unknown,
) {
  const config = watermarkConfigSchema.parse(input);
  const [row] = await deps.db
    .select({ branding: accounts.branding })
    .from(accounts)
    .where(eq(accounts.id, deps.accountId))
    .limit(1);
  if (!row) return;
  await deps.db
    .update(accounts)
    .set({ branding: { ...row.branding, watermark: config } })
    .where(eq(accounts.id, deps.accountId));
}

type Stamp = { config: WatermarkConfig; logoKey: string; signature: string };

/** The account's active watermark, or null while it has no logo. */
export async function loadStamp(
  db: Db,
  accountId: string,
): Promise<Stamp | null> {
  const [row] = await db
    .select({ branding: accounts.branding })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  const logoKey = row?.branding.logoKey;
  if (typeof logoKey !== "string") return null;
  const config = readWatermarkConfig(row.branding);
  const signature = createHash("sha256")
    .update(JSON.stringify([config, logoKey]))
    .digest("hex")
    .slice(0, 12);
  return { config, logoKey, signature };
}

/** Stamps the logo onto an image and returns WebP bytes. */
export async function applyWatermark(
  image: Buffer,
  logo: Buffer,
  config: WatermarkConfig,
): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  if (!width || !height) throw new Error("Unreadable image dimensions.");
  const margin = Math.round(width * 0.03);
  const maxW = Math.max(1, Math.round((width * config.scale) / 100));
  const maxH = Math.max(1, Math.round(height * 0.5));
  const { data: rgba, info: raw } = await sharp(logo)
    .resize({ width: maxW, height: maxH, fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // opacity of the whole stamp = scale the alpha channel
  for (let i = 3; i < rgba.length; i += 4) {
    rgba[i] = Math.round(rgba[i] * (config.opacity / 100));
  }
  const info = { width: raw.width, height: raw.height };
  const data = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
  const left = config.position.endsWith("left")
    ? margin
    : config.position.endsWith("right")
      ? width - info.width - margin
      : Math.round((width - info.width) / 2);
  const top = config.position.startsWith("top")
    ? margin
    : config.position.startsWith("bottom")
      ? height - info.height - margin
      : Math.round((height - info.height) / 2);
  return sharp(image)
    .composite([
      { input: data, left: Math.max(0, left), top: Math.max(0, top) },
    ])
    .webp({ quality: 82 })
    .toBuffer();
}

type MediaRow = Pick<typeof media.$inferSelect, "id" | "revision" | "variants">;

/**
 * Key and size of the watermarked copy of one photo variant, creating it on
 * first use. Null when the account has no logo or the width does not exist.
 */
export async function ensureWatermarked(
  deps: { db: Db; storage: Storage },
  input: {
    accountId: string;
    media: MediaRow;
    width: number;
    stamp?: Stamp | null;
  },
): Promise<{ key: string; size: number } | null> {
  const stamp =
    input.stamp === undefined
      ? await loadStamp(deps.db, input.accountId)
      : input.stamp;
  if (!stamp) return null;
  const variant = (input.media.variants as PhotoVariants)[String(input.width)];
  if (!variant) return null;
  const key = `${input.accountId}/${input.media.id}/r${input.media.revision}-${input.width}-wm${stamp.signature}.webp`;
  const existing = await deps.storage.head(key);
  if (existing) return { key, size: existing.size };
  const [image, logo] = await Promise.all([
    deps.storage.get(variant.key),
    deps.storage.get(stamp.logoKey),
  ]);
  const out = await applyWatermark(image, logo, stamp.config);
  await deps.storage.put(key, out, "image/webp");
  return { key, size: out.length };
}
