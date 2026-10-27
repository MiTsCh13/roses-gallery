// Shared by the upload API (server) and the uploader (browser).
export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
] as const;

export const MAX_PHOTO_BYTES = 100 * 1024 * 1024;
/** S3 multipart parts must be ≥ 5 MiB except the last one. */
export const PART_SIZE = 8 * 1024 * 1024;
