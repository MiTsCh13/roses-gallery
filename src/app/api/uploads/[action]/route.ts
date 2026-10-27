import { ZodError } from "zod";

import { auth } from "@/auth";
import { serverEnv } from "@/lib/env";
import { db } from "@/db";
import { PlanLimitError } from "@/lib/plans";
import { createQueue, enqueue } from "@/lib/queue";
import { getStorage } from "@/lib/storage";
import {
  abortReplacement,
  abortUpload,
  completeReplacement,
  completeUpload,
  signReplacementPart,
  signUploadPart,
  startReplacement,
  startUpload,
  UploadError,
} from "@/lib/uploads";

let uploadQueue: ReturnType<typeof createQueue> | undefined;
function queue() {
  uploadQueue ??= createQueue(serverEnv().REDIS_URL);
  return uploadQueue;
}

// JSON API for the Uppy multipart flow. The account always comes from the
// session, never from the request body.
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

  const deps = { db: db(), storage: getStorage(), accountId };
  try {
    switch ((await ctx.params).action) {
      case "start":
        return Response.json(await startUpload(deps, body));
      case "sign":
        return Response.json(await signUploadPart(deps, body));
      case "complete":
        return Response.json(
          await completeUpload(deps, body, async (uploaded) => {
            await enqueue(queue(), "process-photo", {
              accountId,
              mediaId: uploaded.id,
            });
          }),
        );
      case "abort":
        await abortUpload(deps, body);
        return Response.json({ ok: true });
      case "replace-start":
        return Response.json(await startReplacement(deps, body));
      case "replace-sign":
        return Response.json(await signReplacementPart(deps, body));
      case "replace-complete":
        return Response.json(
          await completeReplacement(deps, body, async (uploaded) => {
            await enqueue(queue(), "process-photo", {
              accountId,
              mediaId: uploaded.id,
            });
          }),
        );
      case "replace-abort":
        await abortReplacement(deps, body);
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
    if (error instanceof UploadError) {
      const status = error.code === "not_found" ? 404 : 409;
      return Response.json({ error: error.code }, { status });
    }
    throw error;
  }
}
