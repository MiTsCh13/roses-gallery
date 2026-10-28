import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { galleries, media, sets, zipExports } from "@/db/schema";
import { allows, effectivePolicy } from "@/lib/download-policy";
import { findVisibleGallery } from "@/lib/downloads";
import type { Mailer } from "@/lib/mailer";
import type { PhotoVariants } from "@/lib/photos";
import type { Storage } from "@/lib/storage/types";
import { ensureWatermarked, loadStamp } from "@/lib/watermark";
import { buildZip, type ZipEntry } from "@/lib/zip-writer";

export const ZIP_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** The archive is assembled in memory (no ZIP64), so it stays well below 4 GB. */
export const ZIP_MAX_BYTES = 1_500_000_000;
export const ZIP_URL_TTL_SECONDS = 60;

export const zipRequestSchema = z.object({
  slug: z.string().min(1).max(200),
  setId: z.uuid().nullable(),
  size: z.enum(["web", "original"]),
  email: z.email().max(254),
});
export type ZipRequest = z.infer<typeof zipRequestSchema>;

type Gallery = typeof galleries.$inferSelect;
type ZipFile = { key: string; name: string; bytes: number };

const safeName = (value: string) =>
  value.replace(/[^\p{L}\p{N}._ -]+/gu, "_").trim() || "Set";

/**
 * Files a ZIP of the gallery (or one set) may contain: ready photos of sets
 * whose effective download policy allows the requested size.
 */
async function selectFiles(
  db: Db,
  gallery: Gallery,
  setId: string | null,
  size: "web" | "original",
  enforcePolicy = true,
  /** Given by the worker only: stamps web sizes of watermarked galleries. */
  storage?: Storage,
): Promise<ZipFile[]> {
  const rows = await db
    .select({ media, setTitle: sets.title, setPolicy: sets.downloadPolicy })
    .from(media)
    .innerJoin(sets, eq(sets.id, media.setId))
    .where(
      and(
        eq(media.accountId, gallery.accountId),
        eq(sets.galleryId, gallery.id),
        eq(media.type, "photo"),
        eq(media.processingStatus, "ready"),
        ...(setId ? [eq(sets.id, setId)] : []),
      ),
    )
    .orderBy(asc(sets.position), asc(media.position), asc(media.createdAt));

  const stamp =
    storage && gallery.watermarkEnabled
      ? await loadStamp(db, gallery.accountId)
      : undefined;
  const counters = new Map<string, number>();
  const files: ZipFile[] = [];
  for (const row of rows) {
    if (
      enforcePolicy &&
      !allows(effectivePolicy(gallery.downloadPolicy, row.setPolicy), size)
    ) {
      continue;
    }
    let key: string | null;
    let bytes: number;
    let ext = "";
    if (size === "original") {
      key = row.media.originalKey;
      bytes = row.media.sizeBytes;
    } else {
      const [nominal, largest] =
        Object.entries(row.media.variants as PhotoVariants).sort(
          ([a], [b]) => Number(b) - Number(a),
        )[0] ?? [];
      key = largest?.key ?? null;
      bytes = largest?.size ?? 0;
      ext = ".webp";
      if (key && storage && gallery.watermarkEnabled) {
        const stamped = await ensureWatermarked(
          { db, storage },
          {
            accountId: gallery.accountId,
            media: row.media,
            width: Number(nominal),
            stamp,
          },
        );
        if (stamped) ({ key, size: bytes } = stamped);
      }
    }
    if (!key) continue;
    const folder = safeName(row.setTitle);
    const n = (counters.get(row.media.setId) ?? 0) + 1;
    counters.set(row.media.setId, n);
    files.push({
      key,
      bytes,
      name: `${folder}/${gallery.slug}-${n}${size === "original" ? "-original" : ""}${ext}`,
    });
  }
  return files;
}

export type ZipRequestResult =
  | { ok: true; exportId: string }
  | { ok: false; reason: "not_found" | "forbidden" | "empty" | "too_large" };

type RequestDeps = {
  db: Db;
  /** Queues the worker job `build-zip`. */
  enqueue: (payload: { accountId: string; exportId: string }) => Promise<void>;
  accessSecret?: string;
  accessToken?: (galleryId: string) => string | undefined;
  now?: Date;
};

/** Visitor asks for a ZIP; the link arrives by mail once the worker is done. */
export async function requestZipExport(
  deps: RequestDeps,
  input: ZipRequest,
): Promise<ZipRequestResult> {
  const req = zipRequestSchema.parse(input);
  const now = deps.now ?? new Date();
  const gallery = await findVisibleGallery(deps, req.slug, now);
  if (!gallery) return { ok: false, reason: "not_found" };

  if (req.setId) {
    const [set] = await deps.db
      .select({ id: sets.id })
      .from(sets)
      .where(and(eq(sets.id, req.setId), eq(sets.galleryId, gallery.id)))
      .limit(1);
    if (!set) return { ok: false, reason: "not_found" };
  }
  const files = await selectFiles(deps.db, gallery, req.setId, req.size);
  if (files.length === 0) {
    // Distinguish "downloads are off" from "nothing uploaded yet".
    const anyPolicy = await selectFiles(
      deps.db,
      gallery,
      req.setId,
      req.size,
      false,
    );
    return {
      ok: false,
      reason: anyPolicy.length > 0 ? "forbidden" : "empty",
    };
  }
  if (files.reduce((sum, f) => sum + f.bytes, 0) > ZIP_MAX_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  const [row] = await deps.db
    .insert(zipExports)
    .values({
      accountId: gallery.accountId,
      galleryId: gallery.id,
      setId: req.setId,
      size: req.size,
      email: req.email.trim().toLowerCase(),
      expiresAt: new Date(now.getTime() + ZIP_LINK_TTL_MS),
    })
    .returning({ id: zipExports.id });
  await deps.enqueue({ accountId: gallery.accountId, exportId: row.id });
  return { ok: true, exportId: row.id };
}

type BuildDeps = {
  db: Db;
  storage: Storage;
  mailer: Mailer;
  baseUrl: string;
  now?: Date;
};

export const zipStorageKey = (accountId: string, exportId: string) =>
  `${accountId}/zips/${exportId}.zip`;

/**
 * Worker side: assemble the archive, store it privately and mail the link.
 * Safe to retry — an already stored archive is not rebuilt, only the mail is
 * sent again.
 */
export async function buildZipExport(
  { db, storage, mailer, baseUrl, now = new Date() }: BuildDeps,
  input: { accountId: string; exportId: string },
) {
  const [row] = await db
    .select()
    .from(zipExports)
    .where(
      and(
        eq(zipExports.id, input.exportId),
        eq(zipExports.accountId, input.accountId),
      ),
    )
    .limit(1);
  if (!row || row.expiresAt <= now) return { status: "skipped" as const };

  const [gallery] = await db
    .select()
    .from(galleries)
    .where(
      and(
        eq(galleries.id, row.galleryId),
        eq(galleries.accountId, row.accountId),
      ),
    )
    .limit(1);

  const fail = async () => {
    await db
      .update(zipExports)
      .set({ status: "failed" })
      .where(
        and(eq(zipExports.id, row.id), eq(zipExports.accountId, row.accountId)),
      );
    return { status: "failed" as const };
  };
  if (!gallery) return fail();

  let key = row.storageKey;
  if (!key) {
    const files = await selectFiles(
      db,
      gallery,
      row.setId,
      row.size,
      true,
      storage,
    );
    if (
      files.length === 0 ||
      files.reduce((sum, f) => sum + f.bytes, 0) > ZIP_MAX_BYTES
    ) {
      return fail();
    }
    const entries: ZipEntry[] = [];
    for (const f of files) {
      entries.push({ name: f.name, data: await storage.get(f.key) });
    }
    const zip = buildZip(entries);
    key = zipStorageKey(row.accountId, row.id);
    await storage.put(key, zip, "application/zip");
    await db
      .update(zipExports)
      .set({ status: "ready", storageKey: key, sizeBytes: zip.length })
      .where(
        and(eq(zipExports.id, row.id), eq(zipExports.accountId, row.accountId)),
      );
  }

  const link = `${baseUrl.replace(/\/$/, "")}/api/g/${encodeURIComponent(gallery.slug)}/zip/${row.id}`;
  const until = row.expiresAt.toLocaleDateString("de-DE");
  await mailer.send({
    to: row.email,
    subject: `Dein Download: ${gallery.title}`,
    text: `Dein ZIP-Download für „${gallery.title}“ ist bereit:\n\n${link}\n\nDer Link ist bis zum ${until} gültig.`,
  });
  return { status: "ready" as const };
}

export type ZipDownloadResult = { ok: true; url: string } | { ok: false };

/**
 * Signed URL for a finished archive. The unguessable export id in the mailed
 * link is the credential (the recipient already passed any gallery password),
 * but the gallery must still be published and the link unexpired.
 */
export async function resolveZipDownload(
  deps: { db: Db; storage: Storage; now?: Date },
  input: { slug: string; exportId: string },
): Promise<ZipDownloadResult> {
  if (!z.uuid().safeParse(input.exportId).success) return { ok: false };
  const now = deps.now ?? new Date();
  const [row] = await deps.db
    .select({ zip: zipExports, gallery: galleries })
    .from(zipExports)
    .innerJoin(galleries, eq(galleries.id, zipExports.galleryId))
    .where(
      and(eq(zipExports.id, input.exportId), eq(galleries.slug, input.slug)),
    )
    .limit(1);
  if (
    !row ||
    row.zip.status !== "ready" ||
    !row.zip.storageKey ||
    row.zip.expiresAt <= now ||
    row.gallery.status !== "published" ||
    (row.gallery.expiresAt && row.gallery.expiresAt <= now)
  ) {
    return { ok: false };
  }
  const url = await deps.storage.signGet(
    row.zip.storageKey,
    ZIP_URL_TTL_SECONDS,
    { downloadName: `${row.gallery.slug}.zip` },
  );
  return { ok: true, url };
}

/** Housekeeping: drops expired archives from storage and their rows. */
export async function cleanupExpiredZips(
  { db, storage }: { db: Db; storage: Storage },
  now: Date = new Date(),
) {
  const expired = await db
    .select()
    .from(zipExports)
    .where(lte(zipExports.expiresAt, now));
  for (const row of expired) {
    if (row.storageKey) await storage.delete(row.storageKey);
  }
  if (expired.length > 0) {
    await db.delete(zipExports).where(
      inArray(
        zipExports.id,
        expired.map((r) => r.id),
      ),
    );
  }
  return { removed: expired.length };
}
