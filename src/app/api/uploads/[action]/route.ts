import { ZodError } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { PlanLimitError } from "@/lib/plans";
import { getStorage } from "@/lib/storage";
import {
  abortUpload,
  completeUpload,
  signUploadPart,
  startUpload,
  UploadError,
} from "@/lib/uploads";

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
        // Processing is enqueued here once the process-photo job exists.
        return Response.json(await completeUpload(deps, body, async () => {}));
      case "abort":
        await abortUpload(deps, body);
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
