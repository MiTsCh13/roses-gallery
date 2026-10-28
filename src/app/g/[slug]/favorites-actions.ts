"use server";

import { cookies, headers } from "next/headers";

import { z } from "zod";

import { db } from "@/db";
import { recordPlay } from "@/lib/events";
import { serverEnv } from "@/lib/env";
import { findVisibleGallery } from "@/lib/downloads";
import {
  createGuest,
  createList,
  createVisitorToken,
  deleteList,
  EMPTY_STATE,
  FavoritesError,
  loadFavoriteState,
  resolveVisitor,
  sendListToCreator,
  toggleFavorite,
  requestMagicLink,
  DEFAULT_LIST_NAME,
  VISITOR_COOKIE_MAX_AGE,
  visitorCookieName,
  type FavoritesState,
} from "@/lib/favorites";
import { accessCookieName } from "@/lib/gallery-access";
import { getMailer } from "@/lib/mailer";
import { getRateLimiter } from "@/lib/rate-limit";

export type FavoritesResult = {
  state: FavoritesState;
  /** Error or success code for the UI; absent on plain success. */
  code?: string;
};

async function context(slug: string) {
  const env = serverEnv();
  if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET is not configured.");
  const secret = env.AUTH_SECRET;
  const jar = await cookies();
  const gallery = await findVisibleGallery(
    {
      db: db(),
      accessSecret: secret,
      accessToken: (id) => jar.get(accessCookieName(id))?.value,
    },
    slug,
    new Date(),
  );
  if (!gallery) return null;
  const visitor = await resolveVisitor(
    { db: db(), secret },
    gallery,
    jar.get(visitorCookieName(gallery.id))?.value,
  );
  return { env, secret, jar, gallery, visitor };
}

async function ip() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

async function guard<T extends FavoritesResult>(
  run: () => Promise<T>,
): Promise<FavoritesResult> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof FavoritesError)
      return { state: EMPTY_STATE, code: e.code };
    throw e;
  }
}

const fresh = async (
  c: NonNullable<Awaited<ReturnType<typeof context>>>,
  visitorId: string | null,
) => loadFavoriteState({ db: db() }, c.gallery, visitorId);

/** The visitor of this request, created (and remembered by cookie) on demand. */
async function ensureVisitor(
  c: NonNullable<Awaited<ReturnType<typeof context>>>,
) {
  if (c.visitor) return c.visitor;
  const visitor = await createGuest({ db: db() }, c.gallery);
  c.jar.set(
    visitorCookieName(c.gallery.id),
    createVisitorToken(c.secret, c.gallery, visitor.id),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
    },
  );
  return visitor;
}

export async function toggleFavoriteAction(
  slug: string,
  mediaId: string,
  listId: string | null,
): Promise<FavoritesResult> {
  return guard(async () => {
    const c = await context(slug);
    if (!c) return { state: EMPTY_STATE, code: "not_found" };
    const limit = await getRateLimiter(c.env.REDIS_URL).hit(
      `fav:${await ip()}`,
      600,
      60 * 60,
    );
    if (!limit.allowed)
      return {
        state: await fresh(c, c.visitor?.id ?? null),
        code: "rate_limited",
      };
    const visitor = await ensureVisitor(c);
    let state = await fresh(c, visitor.id);
    let target = listId ?? state.lists[0]?.id;
    if (!target) {
      target = (
        await createList({ db: db() }, c.gallery, visitor.id, DEFAULT_LIST_NAME)
      ).id;
    }
    await toggleFavorite({ db: db() }, c.gallery, visitor.id, {
      listId: target,
      mediaId,
    });
    state = await fresh(c, visitor.id);
    return { state };
  });
}

export async function createListAction(
  slug: string,
  name: string,
): Promise<FavoritesResult> {
  return guard(async () => {
    const c = await context(slug);
    if (!c) return { state: EMPTY_STATE, code: "not_found" };
    const visitor = await ensureVisitor(c);
    await createList({ db: db() }, c.gallery, visitor.id, name);
    return { state: await fresh(c, visitor.id) };
  });
}

export async function deleteListAction(
  slug: string,
  listId: string,
): Promise<FavoritesResult> {
  return guard(async () => {
    const c = await context(slug);
    if (!c?.visitor) return { state: EMPTY_STATE, code: "not_found" };
    await deleteList({ db: db() }, c.gallery, c.visitor.id, listId);
    return { state: await fresh(c, c.visitor.id) };
  });
}

export async function sendListAction(
  slug: string,
  listId: string,
): Promise<FavoritesResult> {
  return guard(async () => {
    const c = await context(slug);
    if (!c?.visitor) return { state: EMPTY_STATE, code: "not_found" };
    const state = await fresh(c, c.visitor.id);
    const limit = await getRateLimiter(c.env.REDIS_URL).hit(
      `favsend:${c.visitor.id}`,
      5,
      60 * 60,
    );
    if (!limit.allowed) return { state, code: "rate_limited" };
    await sendListToCreator(
      {
        db: db(),
        mailer: getMailer(),
        baseUrl: c.env.AUTH_URL ?? "http://localhost:3000",
      },
      c.gallery,
      c.visitor.id,
      listId,
    );
    return { state, code: "sent" };
  });
}

export async function emailLinkAction(
  slug: string,
  email: string,
): Promise<FavoritesResult> {
  return guard(async () => {
    const c = await context(slug);
    if (!c) return { state: EMPTY_STATE, code: "not_found" };
    const limit = await getRateLimiter(c.env.REDIS_URL).hit(
      `favmail:${await ip()}`,
      5,
      60 * 60,
    );
    if (!limit.allowed)
      return {
        state: await fresh(c, c.visitor?.id ?? null),
        code: "rate_limited",
      };
    const visitor = await ensureVisitor(c);
    await requestMagicLink(
      {
        db: db(),
        mailer: getMailer(),
        baseUrl: c.env.AUTH_URL ?? "http://localhost:3000",
        secret: c.secret,
      },
      c.gallery,
      visitor.id,
      email,
    );
    return { state: await fresh(c, visitor.id), code: "link_sent" };
  });
}

/** Counts a video start (F-DASH-02); only for videos of a visible gallery. */
export async function recordPlayAction(slug: string, mediaId: string) {
  if (!z.uuid().safeParse(mediaId).success) return;
  const c = await context(slug);
  if (!c) return;
  const limit = await getRateLimiter(c.env.REDIS_URL).hit(
    `play:${await ip()}`,
    300,
    60 * 60,
  );
  if (limit.allowed) await recordPlay(db(), c.gallery, mediaId);
}
