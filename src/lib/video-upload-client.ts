import { Upload } from "tus-js-client";

import type { TusUpload } from "@/lib/video/types";

async function postVideo(action: string, body: unknown) {
  const response = await fetch(`/api/videos/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "failed");
  return data;
}

/** Uploads a video via tus; returns the new media id. */
export async function uploadVideoFile(
  file: File,
  opts: {
    folderId?: string;
    onProgress?: (loaded: number) => void;
    onStop?: (stop: () => void) => void;
  } = {},
): Promise<{ mediaId: string }> {
  const { mediaId, tus } = (await postVideo("start", {
    folderId: opts.folderId,
    title: file.name.replace(/\.[^.]+$/, "") || file.name,
    sizeBytes: file.size,
  })) as { mediaId: string; tus: TusUpload };
  await new Promise<void>((resolve, reject) => {
    const up = new Upload(file, {
      endpoint: tus.endpoint,
      headers: tus.headers,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 64 * 1024 * 1024,
      metadata: { filetype: file.type, title: file.name },
      onProgress: (loaded) => opts.onProgress?.(loaded),
      onError: reject,
      onSuccess: () => resolve(),
    });
    opts.onStop?.(() => void up.abort(true));
    up.start();
  });
  await postVideo("refresh", { mediaId });
  return { mediaId };
}
