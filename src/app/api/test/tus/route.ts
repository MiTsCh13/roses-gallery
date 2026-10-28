import { fakeVideoProvider } from "@/lib/video/test-mode";

// Minimal tus server (creation + upload) standing in for Bunny's endpoint in
// E2E/dev. The body is discarded; only offsets are tracked by the client.
export async function POST(request: Request) {
  if (!fakeVideoProvider()) return new Response("Not found", { status: 404 });
  const id = crypto.randomUUID();
  return new Response(null, {
    status: 201,
    headers: {
      Location: new URL(`/api/test/tus/${id}`, request.url).toString(),
      "Tus-Resumable": "1.0.0",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { "Tus-Resumable": "1.0.0", "Tus-Version": "1.0.0" },
  });
}
