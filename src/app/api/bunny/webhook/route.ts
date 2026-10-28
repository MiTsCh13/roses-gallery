import { z } from "zod";

import { db } from "@/db";
import { getVideoProvider } from "@/lib/video";
import { syncVideoByProviderId } from "@/lib/videos";

const payloadSchema = z.object({ VideoGuid: z.string().min(1).max(100) });

// Bunny webhooks are unsigned, so the body only names the video. The real state
// is fetched from the Bunny API (authenticated) before anything is stored.
export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return new Response("Invalid payload", { status: 400 });
  await syncVideoByProviderId(db(), getVideoProvider(), parsed.data.VideoGuid);
  return Response.json({ received: true });
}
