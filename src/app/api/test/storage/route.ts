import { FakeStorage } from "@/lib/storage/fake";
import { getStorage } from "@/lib/storage";
import { serverEnv } from "@/lib/env";

// Stand-in for R2's signed URLs when the fake storage is active (E2E, dev).
function fake() {
  const env = serverEnv();
  if (env.NODE_ENV === "production" && env.E2E_TEST_MODE !== "1") return null;
  const storage = getStorage();
  return storage instanceof FakeStorage ? storage : null;
}

export async function PUT(request: Request) {
  const storage = fake();
  if (!storage) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const signed = storage.verifyUrl(url.searchParams);
  if (signed?.op !== "put-part")
    return new Response("Forbidden", { status: 403 });
  const [uploadId, part] = signed.extra.split(":");
  const body = Buffer.from(await request.arrayBuffer());
  const etag = await storage.storePart(uploadId, Number(part), body);
  return new Response(null, { status: 200, headers: { ETag: `"${etag}"` } });
}

export async function GET(request: Request) {
  const storage = fake();
  if (!storage) return new Response("Not found", { status: 404 });
  const signed = storage.verifyUrl(new URL(request.url).searchParams);
  if (signed?.op !== "get") return new Response("Forbidden", { status: 403 });
  const body = await storage.get(signed.key).catch(() => null);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
