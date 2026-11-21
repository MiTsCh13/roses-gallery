// Seeds a published photo gallery (slug "perf") into the fake storage for the
// LCP check, see scripts/lighthouse-lcp.sh. Uses DATABASE_URL and
// STORAGE_FAKE_DIR; never touches real storage.
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import sharp from "sharp";

import { db } from "../src/db";
import { accounts, galleries, galleryMedia, media } from "../src/db/schema";
import { FakeStorage } from "../src/lib/storage/fake";
import { derivativeKey } from "../src/lib/storage/types";

const SLUG = "perf";
const PHOTOS = 60;
const WIDTHS = [400, 1200, 2400];

async function sample(seed: number) {
  // photo-like: smooth gradients plus mild noise, so WebP sizes are realistic
  const w = 3600;
  const h = 2400;
  const noise = Buffer.alloc(w * h * 3);
  for (let i = 0; i < noise.length; i++) {
    noise[i] = (i * 31 + seed * 17 + ((i >> 3) % 255)) & 0xff;
  }
  return sharp(noise, { raw: { width: w, height: h, channels: 3 } })
    .blur(6)
    .modulate({ hue: seed * 40 })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function main() {
  const database = db();
  const storage = new FakeStorage(
    process.env.STORAGE_FAKE_DIR ??
      path.join(os.tmpdir(), "roses-fake-storage"),
    process.env.AUTH_SECRET ?? "dev-only-storage-secret",
    process.env.AUTH_URL ?? "",
  );

  await database.delete(galleries).where(eq(galleries.slug, SLUG));
  const [account] = await database
    .insert(accounts)
    .values({ name: "Perf" })
    .returning();
  const [gallery] = await database
    .insert(galleries)
    .values({
      accountId: account.id,
      slug: SLUG,
      title: "Perf-Galerie",
      status: "published",
    })
    .returning();
  const bases = await Promise.all([0, 1, 2, 3, 4, 5].map(sample));
  const variantsOf = await Promise.all(
    bases.map(async (base) =>
      Promise.all(
        WIDTHS.map(async (width) => {
          const { data, info } = await sharp(base)
            .resize({ width })
            .webp({ quality: 82 })
            .toBuffer({ resolveWithObject: true });
          return { data, info, width };
        }),
      ),
    ),
  );

  let first: string | null = null;
  for (let i = 0; i < PHOTOS; i++) {
    const [row] = await database
      .insert(media)
      .values({
        accountId: account.id,
        type: "photo",
        position: i,
        width: 3600,
        height: 2400,
        processingStatus: "ready",
      })
      .returning();
    first ??= row.id;
    await database.insert(galleryMedia).values({
      accountId: account.id,
      galleryId: gallery.id,
      mediaId: row.id,
      position: i,
    });
    const variants: Record<string, unknown> = {};
    for (const v of variantsOf[i % variantsOf.length]) {
      const key = derivativeKey(account.id, row.id, 1, v.width);
      await storage.put(key, v.data);
      variants[String(v.width)] = {
        key,
        width: v.info.width,
        height: v.info.height,
        size: v.data.length,
      };
    }
    await database.update(media).set({ variants }).where(eq(media.id, row.id));
  }
  await database
    .update(galleries)
    .set({ coverMediaId: first })
    .where(eq(galleries.id, gallery.id));
  console.log(`seeded /g/${SLUG} with ${PHOTOS} photos`);
  process.exit(0);
}

main();
