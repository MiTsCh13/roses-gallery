import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { serverEnv } from "@/lib/env";
import { accessCookieName } from "@/lib/gallery-access";
import { getRateLimiter } from "@/lib/rate-limit";
import { getStorage } from "@/lib/storage";
import { resolveStoryImage } from "@/lib/story-image";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string; mediaId: string }> },
) {
  const { slug, mediaId } = await ctx.params;
  const env = serverEnv();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // rendering costs CPU: keep a single visitor from hammering it
  const limit = await getRateLimiter(env.REDIS_URL).hit(
    `story:${ip}`,
    60,
    60 * 60,
  );
  if (!limit.allowed) return new NextResponse(null, { status: 429 });
  const jar = await cookies();
  const result = await resolveStoryImage(
    {
      db: db(),
      storage: getStorage(),
      accessSecret: env.AUTH_SECRET,
      accessToken: (id) => jar.get(accessCookieName(id))?.value,
    },
    { slug, mediaId },
  );
  if (!result.ok) {
    return new NextResponse(null, {
      status: result.reason === "forbidden" ? 403 : 404,
    });
  }
  return new NextResponse(new Uint8Array(result.jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=600",
    },
  });
}
