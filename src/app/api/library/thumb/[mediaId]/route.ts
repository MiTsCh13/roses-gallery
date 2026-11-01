import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { tenantDb } from "@/db/tenant";
import { getStorage } from "@/lib/storage";

// Dashboard thumbnail of an own photo: 302 to a short-lived signed URL.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ mediaId: string }> },
) {
  const accountId = (await auth())?.user?.accountId;
  if (!accountId) return new NextResponse(null, { status: 401 });
  const { mediaId } = await ctx.params;
  if (!z.uuid().safeParse(mediaId).success)
    return new NextResponse(null, { status: 404 });

  const row = await tenantDb(db(), accountId).media.get(mediaId);
  const variants = row?.variants as
    Record<string, { key?: string }> | undefined;
  // `?size=large` serves the largest variant (cover preview), else the thumbnail
  const large = new URL(req.url).searchParams.get("size") === "large";
  const nominal = large
    ? Object.keys(variants ?? {})
        .map(Number)
        .sort((a, b) => b - a)[0]
    : 400;
  const key = variants?.[String(nominal)]?.key;
  if (!row || row.type !== "photo" || !key)
    return new NextResponse(null, { status: 404 });
  const url = await getStorage().signGet(key, 300);
  return new NextResponse(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, max-age=120" },
  });
}
