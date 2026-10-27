import { auth } from "@/auth";
import { db } from "@/db";
import { tenantDb } from "@/db/tenant";
import { serverEnv } from "@/lib/env";

// E2E helper until the gallery management (M5) exists: creates a draft gallery
// with one photo set for the signed-in account. Not available in production
// unless E2E_TEST_MODE=1.
export async function POST() {
  const env = serverEnv();
  if (env.NODE_ENV === "production" && env.E2E_TEST_MODE !== "1") {
    return new Response("Not found", { status: 404 });
  }
  const accountId = (await auth())?.user?.accountId;
  if (!accountId) return new Response("Unauthorized", { status: 401 });

  const t = tenantDb(db(), accountId);
  const gallery = await t.galleries.create({
    slug: `e2e-${crypto.randomUUID().slice(0, 8)}`,
    title: "E2E-Galerie",
  });
  const set = await t.sets.create({
    galleryId: gallery.id,
    title: "Fotos",
    type: "photo",
  });
  return Response.json({ setId: set.id });
}
