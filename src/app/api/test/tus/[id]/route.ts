import { fakeVideoProvider } from "@/lib/video/test-mode";

export async function PATCH(request: Request) {
  if (!fakeVideoProvider()) return new Response("Not found", { status: 404 });
  const offset = Number(request.headers.get("upload-offset") ?? 0);
  const received = (await request.arrayBuffer()).byteLength;
  return new Response(null, {
    status: 204,
    headers: {
      "Upload-Offset": String(offset + received),
      "Tus-Resumable": "1.0.0",
    },
  });
}
