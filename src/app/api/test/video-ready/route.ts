import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { tenantDb } from "@/db/tenant";
import { fakeVideoProvider } from "@/lib/video/test-mode";

// E2E helper: pretends Bunny finished encoding one of the caller's videos.
export async function POST(request: Request) {
  const fake = fakeVideoProvider();
  if (!fake) return new Response("Not found", { status: 404 });
  const accountId = (await auth())?.user?.accountId;
  if (!accountId) return new Response("Unauthorized", { status: 401 });

  const { mediaId } = z
    .object({ mediaId: z.uuid() })
    .parse(await request.json());
  const row = await tenantDb(db(), accountId).media.get(mediaId);
  if (!row?.bunnyVideoId) return new Response("Not found", { status: 404 });
  fake.set(row.bunnyVideoId, {
    status: "ready",
    durationS: 62,
    width: 3840,
    height: 2160,
  });
  return Response.json({ ok: true });
}
