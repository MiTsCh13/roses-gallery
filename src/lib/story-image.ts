import sharp from "sharp";

import { allows, effectivePolicy } from "@/lib/download-policy";
import { resolveImageKey } from "@/lib/gallery-image";

// Instagram story (F-INT-02): 1080×1920 JPEG, the photo (watermarked if the
// gallery says so) on a blurred copy of itself, gallery title at the bottom.

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

const escapeXml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function renderStory(
  image: Buffer,
  title: string,
): Promise<Buffer> {
  const background = await sharp(image)
    .rotate()
    .resize(STORY_WIDTH, STORY_HEIGHT, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 0.6 })
    .toBuffer();
  const photo = await sharp(image)
    .rotate()
    .resize({
      width: STORY_WIDTH - 120,
      height: STORY_HEIGHT - 520,
      fit: "inside",
    })
    .toBuffer({ resolveWithObject: true });
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${STORY_WIDTH}" height="160">` +
      `<text x="50%" y="100" text-anchor="middle" font-family="sans-serif" font-size="56" fill="#ffffff">${escapeXml(title.slice(0, 40))}</text></svg>`,
  );
  return sharp(background)
    .composite([
      {
        input: photo.data,
        left: Math.round((STORY_WIDTH - photo.info.width) / 2),
        top: Math.round((STORY_HEIGHT - 160 - photo.info.height) / 2),
      },
      { input: label, left: 0, top: STORY_HEIGHT - 260 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export type StoryResult =
  { ok: true; jpeg: Buffer } | { ok: false; reason: "not_found" | "forbidden" };

/** Story image of one photo; needs the web-size download right (it is a copy). */
export async function resolveStoryImage(
  deps: Parameters<typeof resolveImageKey>[0],
  input: { slug: string; mediaId: string },
): Promise<StoryResult> {
  const r = await resolveImageKey(deps, { ...input, width: 1200 });
  if (!r.ok) return { ok: false, reason: "not_found" };
  if (!allows(effectivePolicy(r.gallery.downloadPolicy, r.setPolicy), "web")) {
    return { ok: false, reason: "forbidden" };
  }
  const jpeg = await renderStory(
    await deps.storage.get(r.key),
    r.gallery.title,
  );
  return { ok: true, jpeg };
}
