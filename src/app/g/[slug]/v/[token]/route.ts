import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { galleries } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import {
  resolveVisitor,
  VISITOR_COOKIE_MAX_AGE,
  visitorCookieName,
} from "@/lib/favorites";

/** Magic link (F-INT-01): adopts the visitor of the token on this device. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; token: string }> },
) {
  const { slug, token } = await ctx.params;
  // relative: behind a proxy the request URL may carry an internal host
  const res = new NextResponse(null, {
    status: 302,
    headers: { Location: `/g/${encodeURIComponent(slug)}` },
  });
  const secret = serverEnv().AUTH_SECRET;
  if (!secret) return res;
  const [gallery] = await db()
    .select()
    .from(galleries)
    .where(and(eq(galleries.slug, slug), eq(galleries.status, "published")))
    .limit(1);
  // the gallery's own password still applies after the redirect
  if (!gallery) return res;
  const visitor = await resolveVisitor({ db: db(), secret }, gallery, token);
  if (visitor) {
    res.cookies.set(visitorCookieName(gallery.id), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
    });
  }
  return res;
}
