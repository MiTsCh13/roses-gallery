import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { tenantDb } from "@/db/tenant";
import { favoritesCsv, galleryFavorites } from "@/lib/favorites-overview";

// CSV export of a gallery's favorite lists for its owner (F-INT-01).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ galleryId: string }> },
) {
  // empty while the second factor is pending (see auth.ts)
  const accountId = (await auth())?.user?.accountId;
  if (!accountId) return new NextResponse(null, { status: 401 });
  const { galleryId } = await ctx.params;
  if (!z.uuid().safeParse(galleryId).success)
    return new NextResponse(null, { status: 404 });
  const gallery = await tenantDb(db(), accountId).galleries.get(galleryId);
  if (!gallery) return new NextResponse(null, { status: 404 });

  const t = await getTranslations("Galleries.favoritesCsv");
  const csv = favoritesCsv(
    await galleryFavorites({ db: db(), accountId }, gallery.id),
    {
      list: t("list"),
      visitor: t("visitor"),
      type: t("type"),
      number: t("number"),
      photo: t("photo"),
      video: t("video"),
      guest: t("guest"),
    },
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="favoriten-${gallery.slug}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
