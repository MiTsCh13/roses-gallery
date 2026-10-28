import { ZodError } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { PlanLimitError } from "@/lib/plans";
import { getVideoProvider } from "@/lib/video";
import {
  playbackUrl,
  removeVideo,
  startVideoUpload,
  syncVideo,
  VideoError,
  videoRefSchema,
} from "@/lib/videos";

// JSON API for video uploads (tus goes straight to the provider). The account
// always comes from the session, never from the request body.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  const session = await auth();
  const accountId = session?.user?.accountId;
  if (!accountId)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const deps = { db: db(), video: getVideoProvider(), accountId };
  try {
    switch ((await ctx.params).action) {
      case "start":
        return Response.json(await startVideoUpload(deps, body));
      case "refresh":
        return Response.json(
          await syncVideo(deps, videoRefSchema.parse(body).mediaId),
        );
      case "playback":
        return Response.json(await playbackUrl(deps, body));
      case "remove":
        await removeVideo(deps, body);
        return Response.json({ ok: true });
      default:
        return Response.json({ error: "not_found" }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }
    if (error instanceof PlanLimitError) {
      return Response.json({ error: error.code }, { status: 403 });
    }
    if (error instanceof VideoError) {
      const status = error.code === "not_found" ? 404 : 409;
      return Response.json({ error: error.code }, { status });
    }
    throw error;
  }
}
