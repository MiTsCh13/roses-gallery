export type VideoStatus = "pending" | "processing" | "ready" | "failed";

export type VideoInfo = {
  status: VideoStatus;
  durationS: number | null;
  width: number | null;
  height: number | null;
};

/** Everything the browser's tus client needs to upload straight to the provider. */
export type TusUpload = {
  endpoint: string;
  headers: Record<string, string>;
  expiresAt: number;
};

/**
 * Hosted video encoding (Bunny Stream in production). Playback is only possible
 * through signed, short-lived URLs.
 */
export interface VideoProvider {
  createVideo(title: string): Promise<{ videoId: string }>;
  createTusUpload(videoId: string, ttlSeconds: number): Promise<TusUpload>;
  getVideo(videoId: string): Promise<VideoInfo | null>;
  signPlaybackUrl(videoId: string, ttlSeconds: number): string;
  /** Signed HLS playlist URL for the own player; null if the provider has none (embed is used). */
  signHlsUrl(videoId: string, ttlSeconds: number): string | null;
  /** Signed, short-lived URL of the untouched original (needs "keep originals"). */
  signOriginalUrl(videoId: string, ttlSeconds: number): string;
  deleteVideo(videoId: string): Promise<void>;
}
