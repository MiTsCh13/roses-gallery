import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { resolvePhotoDownload } from "@/lib/downloads";
import { serverEnv } from "@/lib/env";
import { accessCookieName } from "@/lib/gallery-access";
import { getStorage } from "@/lib/storage";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string; mediaId: string }> },
) {
  const { slug, mediaId } = await ctx.params;
  const size =
    new URL(req.url).searchParams.get("size") === "original"
      ? "original"
      : "web";
  const jar = await cookies();
  const result = await resolvePhotoDownload(
    {
      db: db(),
      storage: getStorage(),
      accessSecret: serverEnv().AUTH_SECRET,
      accessToken: (id) => jar.get(accessCookieName(id))?.value,
    },
    { slug, mediaId, size },
  );
  if (!result.ok) {
    return new NextResponse(null, {
      status: result.reason === "forbidden" ? 403 : 404,
    });
  }
  return new NextResponse(null, {
    status: 302,
    headers: { Location: result.url, "Cache-Control": "no-store" },
  });
}
