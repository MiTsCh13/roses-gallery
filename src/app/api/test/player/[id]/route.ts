import { fakeVideoProvider } from "@/lib/video/test-mode";

export async function GET() {
  if (!fakeVideoProvider()) return new Response("Not found", { status: 404 });
  return new Response(
    "<!doctype html><title>Fake player</title><p>Player</p>",
    {
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}
