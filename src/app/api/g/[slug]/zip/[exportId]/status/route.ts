import { NextResponse } from "next/server";

import { db } from "@/db";
import { getZipStatus } from "@/lib/zip-exports";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; exportId: string }> },
) {
  const { slug, exportId } = await ctx.params;
  const status = await getZipStatus({ db: db() }, { slug, exportId });
  return NextResponse.json(
    { status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
