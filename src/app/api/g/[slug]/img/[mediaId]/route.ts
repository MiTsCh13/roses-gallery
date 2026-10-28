import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { serverEnv } from "@/lib/env";
import { accessCookieName } from "@/lib/gallery-access";
import { resolveGalleryImage } from "@/lib/gallery-image";
import { getStorage } from "@/lib/storage";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string; mediaId: string }> },
) {
  const { slug, mediaId } = await ctx.params;
  const width = Number(new URL(req.url).searchParams.get("w"));
  const jar = await cookies();
  const result = await resolveGalleryImage(
    {
      db: db(),
      storage: getStorage(),
      accessSecret: serverEnv().AUTH_SECRET,
      accessToken: (id) => jar.get(accessCookieName(id))?.value,
    },
    { slug, mediaId, width },
  );
  if (!result.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: result.url,
      // shorter than the signed URL's lifetime
      "Cache-Control": "private, max-age=600",
    },
  });
}
