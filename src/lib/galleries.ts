import { downloadPolicySchema } from "@/lib/download-policy";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { accounts, galleries, galleryMedia, media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { assertCanCreateGallery, type SubscriptionStatus } from "@/lib/plans";

export class GalleryError extends Error {
  constructor(
    readonly code: "not_found" | "slug_taken" | "invalid_state",
    message: string,
  ) {
    super(message);
    this.name = "GalleryError";
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.date().nullable(),
);

const fields = {
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(60)
    .regex(SLUG_RE)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  eventDate: optionalDate,
  expiresAt: optionalDate,
};

export const createGallerySchema = z.object(fields);

export const updateGallerySchema = z.object({
  galleryId: z.uuid(),
  ...fields,
  status: z.enum(["draft", "published", "expired", "archived"]),
  coverMediaId: z.uuid().nullable().optional(),
  /** Undefined = unchanged, empty = remove. */
  description: z.string().trim().max(300).optional(),
  downloadPolicy: downloadPolicySchema.optional(),
  watermarkEnabled: z.boolean().optional(),
});

type Deps = { db: Db; accountId: string };

function isUniqueViolation(e: unknown): boolean {
  const code = e as { code?: string; cause?: { code?: string } } | null;
  return code?.code === "23505" || code?.cause?.code === "23505";
}

async function freeSlug(deps: Deps, base: string): Promise<string> {
  const root = base || "galerie";
  for (let i = 1; i < 100; i++) {
    const candidate = i === 1 ? root : `${root.slice(0, 56)}-${i}`;
    const [hit] = await deps.db
      .select({ id: galleries.id })
      .from(galleries)
      .where(eq(galleries.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  return `${root.slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Creates a draft gallery after checking the plan's gallery limit. */
export async function createGallery(deps: Deps, input: unknown) {
  const data = createGallerySchema.parse(input);
  const [account] = await deps.db
    .select()
    .from(accounts)
    .where(eq(accounts.id, deps.accountId))
    .limit(1);
  if (!account) throw new GalleryError("not_found", "Account not found.");
  const [{ n }] = await deps.db
    .select({ n: count() })
    .from(galleries)
    .where(eq(galleries.accountId, deps.accountId));
  assertCanCreateGallery(
    {
      plan: account.plan,
      subscriptionStatus: account.subscriptionStatus as SubscriptionStatus,
    },
    n,
  );

  // A generated slug can lose a race against a concurrent create: retry.
  for (let attempt = 0; ; attempt++) {
    const slug = data.slug ?? (await freeSlug(deps, slugify(data.title)));
    try {
      return await tenantDb(deps.db, deps.accountId).galleries.create({
        title: data.title,
        slug,
        eventDate: data.eventDate,
        expiresAt: data.expiresAt,
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      if (data.slug || attempt >= 4)
        throw new GalleryError("slug_taken", "Slug already in use.");
    }
  }
}

export async function updateGallery(deps: Deps, input: unknown) {
  const { galleryId, ...data } = updateGallerySchema.parse(input);
  const t = tenantDb(deps.db, deps.accountId);
  const current = await t.galleries.get(galleryId);
  if (!current) throw new GalleryError("not_found", "Gallery not found.");
  // A moved expiry date needs a fresh reminder.
  const expiryMoved =
    current.expiresAt?.getTime() !== data.expiresAt?.getTime();

  if (data.coverMediaId) {
    const [cover] = await deps.db
      .select({ id: media.id })
      .from(media)
      .innerJoin(galleryMedia, eq(galleryMedia.mediaId, media.id))
      .where(
        and(
          eq(media.id, data.coverMediaId),
          eq(media.accountId, deps.accountId),
          eq(galleryMedia.galleryId, galleryId),
          eq(media.type, "photo"),
        ),
      )
      .limit(1);
    if (!cover) throw new GalleryError("not_found", "Cover not found.");
  }

  try {
    const row = await t.galleries.update(galleryId, {
      title: data.title,
      ...(data.slug ? { slug: data.slug } : {}),
      ...(data.description !== undefined
        ? { description: data.description || null }
        : {}),
      eventDate: data.eventDate,
      expiresAt: data.expiresAt,
      ...(expiryMoved ? { expiryReminderSentAt: null } : {}),
      status: data.status,
      ...(data.downloadPolicy ? { downloadPolicy: data.downloadPolicy } : {}),
      ...(data.watermarkEnabled !== undefined
        ? { watermarkEnabled: data.watermarkEnabled }
        : {}),
      ...(data.coverMediaId !== undefined
        ? { coverMediaId: data.coverMediaId }
        : {}),
    });
    return row!;
  } catch (e) {
    if (isUniqueViolation(e))
      throw new GalleryError("slug_taken", "Slug already in use.");
    throw e;
  }
}

export type GalleryOverviewRow = typeof galleries.$inferSelect & {
  mediaCount: number;
  storageBytes: number;
};

/** All galleries of the account with media count and booked storage. */
export async function galleryOverview(
  deps: Deps,
): Promise<GalleryOverviewRow[]> {
  const rows = await deps.db
    .select({
      gallery: galleries,
      mediaCount: sql<number>`count(${media.id})::int`,
      storageBytes: sql<number>`coalesce(sum(${media.sizeBytes}), 0)::float8`,
    })
    .from(galleries)
    .leftJoin(galleryMedia, eq(galleryMedia.galleryId, galleries.id))
    .leftJoin(media, eq(media.id, galleryMedia.mediaId))
    .where(eq(galleries.accountId, deps.accountId))
    .groupBy(galleries.id)
    .orderBy(sql`${galleries.createdAt} desc`);
  return rows.map((r) => ({
    ...r.gallery,
    mediaCount: r.mediaCount,
    storageBytes: r.storageBytes,
  }));
}

/** Sets (or, with null, clears) the cover; the media must belong to the gallery. */
export async function setGalleryCover(
  deps: Deps,
  galleryId: string,
  mediaId: string | null,
) {
  const g = await tenantDb(deps.db, deps.accountId).galleries.get(galleryId);
  if (!g) throw new GalleryError("not_found", "Gallery not found.");
  return updateGallery(deps, {
    galleryId,
    title: g.title,
    status: g.status,
    eventDate: g.eventDate,
    expiresAt: g.expiresAt,
    coverMediaId: mediaId,
  });
}
