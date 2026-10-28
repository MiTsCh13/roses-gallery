import { NextResponse } from "next/server";

import { db } from "@/db";
import { getStorage } from "@/lib/storage";
import { resolveZipDownload } from "@/lib/zip-exports";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; exportId: string }> },
) {
  const { slug, exportId } = await ctx.params;
  const result = await resolveZipDownload(
    { db: db(), storage: getStorage() },
    { slug, exportId },
  );
  if (!result.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: result.url,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
