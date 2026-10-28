import { fakeVideoProvider } from "@/lib/video/test-mode";

export async function GET() {
  if (!fakeVideoProvider()) return new Response("Not found", { status: 404 });
  return new Response("original", {
    headers: { "content-disposition": 'attachment; filename="original.mp4"' },
  });
}
