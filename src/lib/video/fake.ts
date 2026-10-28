import type { TusUpload, VideoInfo, VideoProvider } from "./types";

/** Test double: videos live in memory; tests drive their status with `set`. */
export class FakeVideoProvider implements VideoProvider {
  readonly isFake = true;
  readonly videos = new Map<string, VideoInfo>();
  private counter = 0;

  async createVideo() {
    const videoId = `fake-video-${++this.counter}`;
    this.videos.set(videoId, {
      status: "pending",
      durationS: null,
      width: null,
      height: null,
    });
    return { videoId };
  }

  async createTusUpload(
    videoId: string,
    ttlSeconds: number,
  ): Promise<TusUpload> {
    return {
      endpoint: "/api/test/tus",
      headers: { VideoId: videoId },
      expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
  }

  async getVideo(videoId: string) {
    return this.videos.get(videoId) ?? null;
  }

  signPlaybackUrl(videoId: string, ttlSeconds: number) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/api/test/player/${videoId}?expires=${expires}&token=fake`;
  }

  signHlsUrl(): string | null {
    return null;
  }

  signOriginalUrl(videoId: string, ttlSeconds: number) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/api/test/original/${videoId}?expires=${expires}&token=fake`;
  }

  async deleteVideo(videoId: string) {
    this.videos.delete(videoId);
  }

  set(videoId: string, info: Partial<VideoInfo>) {
    const current = this.videos.get(videoId);
    if (!current) throw new Error(`Unknown fake video ${videoId}`);
    this.videos.set(videoId, { ...current, ...info });
  }
}
