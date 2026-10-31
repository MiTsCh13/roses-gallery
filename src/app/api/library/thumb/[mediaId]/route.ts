import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { tenantDb } from "@/db/tenant";
import { getStorage } from "@/lib/storage";

// Dashboard thumbnail of an own photo: 302 to a short-lived signed URL.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ mediaId: string }> },
) {
  const accountId = (await auth())?.user?.accountId;
  if (!accountId) return new NextResponse(null, { status: 401 });
  const { mediaId } = await ctx.params;
  if (!z.uuid().safeParse(mediaId).success)
    return new NextResponse(null, { status: 404 });

  const row = await tenantDb(db(), accountId).media.get(mediaId);
  const key = (row?.variants as Record<string, { key?: string }> | undefined)?.[
    "400"
  ]?.key;
  if (!row || row.type !== "photo" || !key)
    return new NextResponse(null, { status: 404 });
  const url = await getStorage().signGet(key, 300);
  return new NextResponse(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, max-age=120" },
  });
}
