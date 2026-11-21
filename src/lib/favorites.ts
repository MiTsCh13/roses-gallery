import { createHmac, timingSafeEqual } from "node:crypto";

import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import {
  favoriteLists,
  favorites,
  media,
  galleryMedia,
  users,
  visitors,
  type galleries,
} from "@/db/schema";
import { recordEvent } from "@/lib/events";
import type { Mailer } from "@/lib/mailer";

// Favorites without an account (F-INT-01). A visitor is identified by a signed
// token held in a cookie (or arriving via magic link), so there is no secret
// in the database and no login. Every query is scoped to the gallery's account.

type Gallery = typeof galleries.$inferSelect;
type GalleryRef = Pick<Gallery, "id" | "accountId">;

export const MAX_LISTS = 20;
export const MAX_FAVORITES_PER_LIST = 2000;
export const DEFAULT_LIST_NAME = "Favoriten";
export const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export const visitorCookieName = (galleryId: string) =>
  `rg-visitor-${galleryId}`;

export class FavoritesError extends Error {
  constructor(
    readonly code: "not_found" | "limit" | "invalid" | "empty" | "no_recipient",
    message: string,
  ) {
    super(message);
    this.name = "FavoritesError";
  }
}

export type FavoritesState = {
  lists: { id: string; name: string; mediaIds: string[] }[];
  /** True once the visitor left an e-mail (magic link requested). */
  hasEmail: boolean;
};
export const EMPTY_STATE: FavoritesState = { lists: [], hasEmail: false };

const mac = (secret: string, visitorId: string, galleryId: string) =>
  createHmac("sha256", secret)
    .update(`visitor:${galleryId}:${visitorId}`)
    .digest("base64url");

export function createVisitorToken(
  secret: string,
  gallery: Pick<Gallery, "id">,
  visitorId: string,
): string {
  return `${visitorId}.${mac(secret, visitorId, gallery.id)}`;
}

/** Visitor id inside a valid token for this gallery, else null. */
export function parseVisitorToken(
  secret: string,
  gallery: Pick<Gallery, "id">,
  token: string | undefined,
): string | null {
  if (!token) return null;
  const [visitorId, given] = token.split(".");
  if (!visitorId || !given || !z.uuid().safeParse(visitorId).success)
    return null;
  const a = Buffer.from(given);
  const b = Buffer.from(mac(secret, visitorId, gallery.id));
  return a.length === b.length && timingSafeEqual(a, b) ? visitorId : null;
}

type Deps = { db: Db };

async function findVisitor(deps: Deps, gallery: GalleryRef, visitorId: string) {
  const [v] = await deps.db
    .select()
    .from(visitors)
    .where(
      and(
        eq(visitors.id, visitorId),
        eq(visitors.accountId, gallery.accountId),
        eq(visitors.galleryId, gallery.id),
      ),
    )
    .limit(1);
  return v ?? null;
}

/** The visitor behind a token (must exist in this gallery), or null. */
export async function resolveVisitor(
  deps: Deps & { secret: string },
  gallery: GalleryRef,
  token: string | undefined,
) {
  const id = parseVisitorToken(deps.secret, gallery, token);
  return id ? findVisitor(deps, gallery, id) : null;
}

export async function createGuest(deps: Deps, gallery: Gallery) {
  const [v] = await deps.db
    .insert(visitors)
    .values({
      accountId: gallery.accountId,
      galleryId: gallery.id,
      role: "guest",
    })
    .returning();
  return v;
}

export async function loadFavoriteState(
  deps: Deps,
  gallery: GalleryRef,
  visitorId: string | null,
): Promise<FavoritesState> {
  if (!visitorId) return EMPTY_STATE;
  const visitor = await findVisitor(deps, gallery, visitorId);
  if (!visitor) return EMPTY_STATE;
  const lists = await deps.db
    .select()
    .from(favoriteLists)
    .where(
      and(
        eq(favoriteLists.accountId, gallery.accountId),
        eq(favoriteLists.visitorId, visitor.id),
      ),
    )
    .orderBy(asc(favoriteLists.createdAt), asc(favoriteLists.id));
  const favs = lists.length
    ? await deps.db
        .select()
        .from(favorites)
        .where(
          and(
            eq(favorites.accountId, gallery.accountId),
            inArray(
              favorites.listId,
              lists.map((l) => l.id),
            ),
          ),
        )
        .orderBy(asc(favorites.createdAt))
    : [];
  return {
    hasEmail: !!visitor.email,
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      mediaIds: favs.filter((f) => f.listId === l.id).map((f) => f.mediaId),
    })),
  };
}

const nameSchema = z.string().trim().min(1).max(60);

export async function createList(
  deps: Deps,
  gallery: Gallery,
  visitorId: string,
  name: unknown,
) {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) throw new FavoritesError("invalid", "Invalid name.");
  const existing = await deps.db
    .select({ id: favoriteLists.id })
    .from(favoriteLists)
    .where(
      and(
        eq(favoriteLists.accountId, gallery.accountId),
        eq(favoriteLists.visitorId, visitorId),
      ),
    );
  if (existing.length >= MAX_LISTS)
    throw new FavoritesError("limit", "Too many lists.");
  const [list] = await deps.db
    .insert(favoriteLists)
    .values({
      accountId: gallery.accountId,
      visitorId,
      name: parsed.data,
    })
    .returning();
  return list;
}

async function ownList(
  deps: Deps,
  gallery: Gallery,
  visitorId: string,
  listId: string,
) {
  const [list] = await deps.db
    .select()
    .from(favoriteLists)
    .where(
      and(
        eq(favoriteLists.id, listId),
        eq(favoriteLists.accountId, gallery.accountId),
        eq(favoriteLists.visitorId, visitorId),
      ),
    )
    .limit(1);
  if (!list) throw new FavoritesError("not_found", "List not found.");
  return list;
}

export async function deleteList(
  deps: Deps,
  gallery: Gallery,
  visitorId: string,
  listId: string,
) {
  const list = await ownList(deps, gallery, visitorId, listId);
  await deps.db
    .delete(favoriteLists)
    .where(
      and(
        eq(favoriteLists.id, list.id),
        eq(favoriteLists.accountId, gallery.accountId),
      ),
    );
}

/** Adds the photo or video to the list, or removes it if it is already there. */
export async function toggleFavorite(
  deps: Deps,
  gallery: Gallery,
  visitorId: string,
  input: { listId: string; mediaId: string },
) {
  if (
    !z.uuid().safeParse(input.listId).success ||
    !z.uuid().safeParse(input.mediaId).success
  ) {
    throw new FavoritesError("not_found", "Not found.");
  }
  const list = await ownList(deps, gallery, visitorId, input.listId);
  const [photo] = await deps.db
    .select({ id: media.id })
    .from(media)
    .innerJoin(galleryMedia, eq(galleryMedia.mediaId, media.id))
    .where(
      and(
        eq(media.id, input.mediaId),
        eq(media.accountId, gallery.accountId),
        eq(galleryMedia.galleryId, gallery.id),
      ),
    )
    .limit(1);
  if (!photo) throw new FavoritesError("not_found", "Media not found.");

  const where = and(
    eq(favorites.listId, list.id),
    eq(favorites.accountId, gallery.accountId),
  );
  const current = await deps.db.select().from(favorites).where(where);
  if (current.some((f) => f.mediaId === photo.id)) {
    await deps.db
      .delete(favorites)
      .where(and(where, eq(favorites.mediaId, photo.id)));
    return { favorite: false };
  }
  if (current.length >= MAX_FAVORITES_PER_LIST)
    throw new FavoritesError("limit", "List is full.");
  await deps.db
    .insert(favorites)
    .values({
      accountId: gallery.accountId,
      listId: list.id,
      mediaId: photo.id,
    })
    .onConflictDoNothing();
  await recordEvent(deps.db, gallery, "favorite", photo.id);
  return { favorite: true };
}

type MailDeps = Deps & { mailer: Mailer; baseUrl: string; secret: string };

/**
 * Attaches an e-mail to the visitor and mails a magic link that opens the same
 * favorites on another device. If the e-mail already belongs to another
 * visitor of this gallery, that visitor's link is sent instead.
 */
export async function requestMagicLink(
  deps: MailDeps,
  gallery: Gallery,
  visitorId: string,
  email: unknown,
) {
  const parsed = z.email().max(254).safeParse(email);
  if (!parsed.success) throw new FavoritesError("invalid", "Invalid e-mail.");
  const address = parsed.data.toLowerCase();
  const visitor = await findVisitor(deps, gallery, visitorId);
  if (!visitor) throw new FavoritesError("not_found", "Visitor not found.");

  const [other] = await deps.db
    .select()
    .from(visitors)
    .where(
      and(
        eq(visitors.accountId, gallery.accountId),
        eq(visitors.galleryId, gallery.id),
        eq(visitors.email, address),
      ),
    )
    .limit(1);
  let target = other;
  if (!target) {
    [target] = await deps.db
      .update(visitors)
      .set({ email: address, role: "client" })
      .where(
        and(
          eq(visitors.id, visitor.id),
          eq(visitors.accountId, gallery.accountId),
        ),
      )
      .returning();
  }
  const token = createVisitorToken(deps.secret, gallery, target.id);
  const link = `${deps.baseUrl}/g/${encodeURIComponent(gallery.slug)}/v/${token}`;
  await deps.mailer.send({
    to: address,
    subject: `Deine Favoriten: ${gallery.title}`,
    text: `Über diesen Link öffnest du deine Favoriten der Galerie „${gallery.title}“ auf jedem Gerät:\n\n${link}\n\nDie Galerie selbst bleibt – falls vorhanden – passwortgeschützt.`,
  });
}

/** Mails the list's contents to the account owners (F-INT-01 export). */
export async function sendListToCreator(
  deps: Deps & { mailer: Mailer; baseUrl: string },
  gallery: Gallery,
  visitorId: string,
  listId: string,
) {
  const visitor = await findVisitor(deps, gallery, visitorId);
  if (!visitor) throw new FavoritesError("not_found", "Visitor not found.");
  const list = await ownList(deps, gallery, visitorId, listId);
  const rows = await deps.db
    .select({ m: media })
    .from(favorites)
    .innerJoin(media, eq(media.id, favorites.mediaId))
    .innerJoin(galleryMedia, eq(galleryMedia.mediaId, media.id))
    .where(
      and(
        eq(favorites.listId, list.id),
        eq(favorites.accountId, gallery.accountId),
        eq(media.accountId, gallery.accountId),
        eq(galleryMedia.galleryId, gallery.id),
      ),
    );
  if (rows.length === 0) throw new FavoritesError("empty", "List is empty.");
  const owners = await deps.db
    .select({ email: users.email })
    .from(users)
    .where(
      and(eq(users.accountId, gallery.accountId), eq(users.role, "owner")),
    );
  const to = [...new Set(owners.map((o) => o.email).filter(Boolean))];
  if (to.length === 0)
    throw new FavoritesError("no_recipient", "No recipient.");

  // photo numbers follow the gallery order, matching what the visitor sees
  const all = await deps.db
    .select({ id: media.id, type: media.type })
    .from(galleryMedia)
    .innerJoin(media, eq(media.id, galleryMedia.mediaId))
    .where(
      and(
        eq(galleryMedia.accountId, gallery.accountId),
        eq(galleryMedia.galleryId, gallery.id),
        eq(media.processingStatus, "ready"),
      ),
    )
    .orderBy(asc(galleryMedia.position), asc(media.createdAt));
  // photos and videos are numbered separately, as the visitor sees them
  const numberOf = new Map<string, number>();
  const counters = { photo: 0, video: 0 };
  for (const item of all) numberOf.set(item.id, ++counters[item.type]);
  const numbers = (type: "photo" | "video") =>
    rows
      .filter((r) => r.m.type === type)
      .map((r) => numberOf.get(r.m.id) ?? 0)
      .sort((x, y) => x - y);
  const photoNums = numbers("photo");
  const videoNums = numbers("video");
  const lines = [
    ...(photoNums.length ? [`Fotos: ${photoNums.join(", ")}`] : []),
    ...(videoNums.length ? [`Videos: ${videoNums.join(", ")}`] : []),
  ];
  const who = visitor.email ?? "ein Gast";
  const mail = {
    subject: `Favoritenliste „${list.name}“ – ${gallery.title}`,
    text: `${who} hat die Liste „${list.name}“ (${rows.length} Medien) aus der Galerie „${gallery.title}“ gesendet:\n\n${lines.join("\n")}\n\nGalerie: ${deps.baseUrl}/g/${encodeURIComponent(gallery.slug)}`,
  };
  for (const address of to) await deps.mailer.send({ ...mail, to: address });
  return { count: rows.length };
}
