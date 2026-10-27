export type UploadedPart = { partNumber: number; etag: string };

export class StorageKeyError extends Error {
  constructor(key: string) {
    super(`Invalid storage key: ${JSON.stringify(key)}`);
    this.name = "StorageKeyError";
  }
}

/** Keys are relative, slash-separated, without traversal or odd characters. */
const KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

export function assertValidKey(key: string) {
  if (key.length > 512 || key.includes("..") || !KEY_PATTERN.test(key)) {
    throw new StorageKeyError(key);
  }
}

/** Object keys always start with the owning account (tenant separation). */
export function originalKey(accountId: string, mediaId: string, revision = 1) {
  return `${accountId}/${mediaId}/original-${revision}`;
}

export function derivativeKey(
  accountId: string,
  mediaId: string,
  revision: number,
  width: number,
) {
  return `${accountId}/${mediaId}/r${revision}-${width}.webp`;
}

/**
 * Private object storage (Cloudflare R2 in production). Media is never public:
 * clients only ever get short-lived signed URLs.
 */
export interface Storage {
  createMultipartUpload(key: string, contentType: string): Promise<string>;
  /** Signed PUT URL for one part (parts 1..10000). */
  signUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds: number,
  ): Promise<string>;
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadedPart[],
  ): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  /** Signed, short-lived GET URL. */
  signGet(
    key: string,
    expiresInSeconds: number,
    opts?: { downloadName?: string },
  ): Promise<string>;
  /** Server-side access for the worker. */
  get(key: string): Promise<Buffer>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Size in bytes, or `null` if the object does not exist. */
  head(key: string): Promise<{ size: number } | null>;
  /** Idempotent. */
  delete(key: string): Promise<void>;
}
