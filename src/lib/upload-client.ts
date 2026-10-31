import { PHOTO_CONTENT_TYPES } from "@/lib/upload-limits";

export type UploadErrorCode =
  "unsupported_type" | "plan_limit" | "aborted" | "failed";

export class UploadClientError extends Error {
  constructor(
    readonly code: UploadErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "UploadClientError";
  }
}

export type UploadTransport = {
  /** POSTs JSON to /api/uploads/<action>; resolves the parsed body. */
  post(action: string, body: unknown): Promise<unknown>;
  /** PUTs one part to a signed URL; resolves the part's ETag. */
  putPart(
    url: string,
    blob: Blob,
    onProgress: (loaded: number) => void,
    signal: AbortSignal,
  ): Promise<string>;
};

export type UploadOptions = {
  setId?: string;
  folderId?: string;
  signal: AbortSignal;
  onProgress: (loaded: number, total: number) => void;
  /** Attempts per part before the whole file fails. */
  partAttempts?: number;
  retryDelayMs?: number;
};

type StartResponse = { mediaId: string; uploadId: string; partSize: number };

const isSupported = (type: string): boolean =>
  (PHOTO_CONTENT_TYPES as readonly string[]).includes(type);

/**
 * Multipart upload of one photo. Failed parts are retried on their own, so a
 * flaky connection never restarts the whole file; cancelling aborts the
 * multipart upload so no orphaned parts stay in the bucket.
 */
export async function uploadPhoto(
  file: File,
  transport: UploadTransport,
  {
    setId,
    folderId,
    signal,
    onProgress,
    partAttempts = 3,
    retryDelayMs = 1000,
  }: UploadOptions,
): Promise<{ mediaId: string }> {
  if (!isSupported(file.type)) throw new UploadClientError("unsupported_type");

  const start = (await transport
    .post("start", {
      setId,
      folderId,
      contentType: file.type,
      sizeBytes: file.size,
    })
    .catch(asClientError)) as StartResponse;
  const { mediaId, uploadId, partSize } = start;
  const total = file.size;
  const partCount = Math.max(1, Math.ceil(total / partSize));
  const parts: { partNumber: number; etag: string }[] = [];
  let done = 0;

  try {
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const blob = file.slice(
        (partNumber - 1) * partSize,
        partNumber * partSize,
      );
      let etag: string | undefined;
      for (let attempt = 1; !etag; attempt++) {
        if (signal.aborted) throw new UploadClientError("aborted");
        try {
          // Signed URLs are short-lived: sign again for every attempt.
          const { url } = (await transport.post("sign", {
            mediaId,
            uploadId,
            partNumber,
          })) as { url: string };
          etag = await transport.putPart(
            url,
            blob,
            (loaded) => onProgress(done + loaded, total),
            signal,
          );
        } catch (error) {
          if (signal.aborted) throw new UploadClientError("aborted");
          if (attempt >= partAttempts) throw error;
          await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
        }
      }
      parts.push({ partNumber, etag });
      done += blob.size;
      onProgress(done, total);
    }
    await transport
      .post("complete", { mediaId, uploadId, parts })
      .catch(asClientError);
    return { mediaId };
  } catch (error) {
    // Best effort: leave nothing behind in storage or the database.
    await transport.post("abort", { mediaId, uploadId }).catch(() => {});
    throw error instanceof UploadClientError
      ? error
      : new UploadClientError("failed");
  }
}

function asClientError(error: unknown): never {
  if (error instanceof UploadClientError) throw error;
  throw new UploadClientError("failed");
}

/** Browser transport: fetch for the JSON API, XHR for part progress. */
export const browserTransport: UploadTransport = {
  async post(action, body) {
    const res = await fetch(`/api/uploads/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    const code = (json as { error?: string }).error ?? "";
    throw new UploadClientError(
      code === "storage_exceeded" || code === "feature_unavailable"
        ? "plan_limit"
        : "failed",
      code,
    );
  },
  putPart(url, blob, onProgress, signal) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => onProgress(e.loaded);
      xhr.onload = () => {
        const etag = xhr.getResponseHeader("ETag");
        if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
        else reject(new Error(`part upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("part upload failed"));
      xhr.onabort = () => reject(new Error("aborted"));
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.send(blob);
    });
  },
};
