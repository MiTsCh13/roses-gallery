import { createHash } from "node:crypto";
import { z } from "zod";

import type { TusUpload, VideoInfo, VideoProvider, VideoStatus } from "./types";

const API = "https://video.bunnycdn.com";

const videoSchema = z.object({
  status: z.number(),
  length: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

// Bunny: 0 created, 1 uploaded, 2 processing, 3 transcoding, 4 finished,
// 5 error, 6 upload failed. Higher codes are JIT/captions states: treat as ready.
export function mapBunnyStatus(code: number): VideoStatus {
  if (code === 0) return "pending";
  if (code >= 1 && code <= 3) return "processing";
  if (code === 5 || code === 6) return "failed";
  return "ready";
}

const sha256Hex = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export class BunnyVideoProvider implements VideoProvider {
  constructor(
    private readonly config: {
      libraryId: string;
      apiKey: string;
      tokenKey: string;
      cdnHostname?: string;
      // Pull-zone token key; Bunny keeps it separate from the embed key.
      cdnTokenKey?: string;
    },
  ) {}

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(
      `${API}/library/${this.config.libraryId}${path}`,
      {
        ...init,
        headers: {
          AccessKey: this.config.apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
      },
    );
    return response;
  }

  async createVideo(title: string) {
    const response = await this.request("/videos", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      throw new Error(`Bunny createVideo failed (${response.status})`);
    }
    const { guid } = z
      .object({ guid: z.string().min(1) })
      .parse(await response.json());
    return { videoId: guid };
  }

  async createTusUpload(
    videoId: string,
    ttlSeconds: number,
  ): Promise<TusUpload> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const { libraryId, apiKey } = this.config;
    return {
      endpoint: `${API}/tusupload`,
      expiresAt,
      headers: {
        AuthorizationSignature: sha256Hex(
          `${libraryId}${apiKey}${expiresAt}${videoId}`,
        ),
        AuthorizationExpire: String(expiresAt),
        VideoId: videoId,
        LibraryId: libraryId,
      },
    };
  }

  async getVideo(videoId: string): Promise<VideoInfo | null> {
    const response = await this.request(
      `/videos/${encodeURIComponent(videoId)}`,
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Bunny getVideo failed (${response.status})`);
    }
    const data = videoSchema.parse(await response.json());
    return {
      status: mapBunnyStatus(data.status),
      durationS: data.length ? Math.round(data.length) : null,
      width: data.width || null,
      height: data.height || null,
    };
  }

  signPlaybackUrl(videoId: string, ttlSeconds: number) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = sha256Hex(`${this.config.tokenKey}${videoId}${expires}`);
    return `https://iframe.mediadelivery.net/embed/${this.config.libraryId}/${videoId}?token=${token}&expires=${expires}`;
  }

  /**
   * Directory-scoped CDN token so the playlist and all segments share one token.
   * Only offered with a dedicated pull-zone key (D-117); without it the embed is used.
   */
  signHlsUrl(videoId: string, ttlSeconds: number) {
    return this.signCdnFile(videoId, "playlist.m3u8", ttlSeconds);
  }

  /** Poster frame; lives in the same token-protected directory as the playlist. */
  signThumbnailUrl(videoId: string, ttlSeconds: number) {
    return this.signCdnFile(videoId, "thumbnail.jpg", ttlSeconds);
  }

  private signCdnFile(videoId: string, file: string, ttlSeconds: number) {
    const host = this.config.cdnHostname;
    if (!host || !this.config.cdnTokenKey) return null;
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const tokenPath = `/${videoId}/`;
    const token = createHash("sha256")
      .update(
        `${this.config.cdnTokenKey}${tokenPath}${expires}token_path=${tokenPath}`,
      )
      .digest("base64url");
    const query = new URLSearchParams({
      token,
      expires: String(expires),
      token_path: tokenPath,
    });
    return `https://${host}${tokenPath}${file}?${query}`;
  }

  signOriginalUrl(videoId: string, ttlSeconds: number) {
    const host = this.config.cdnHostname;
    if (!host) throw new Error("BUNNY_STREAM_CDN_HOSTNAME is required.");
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const path = `/${videoId}/original`;
    // CDN token authentication: url-safe base64 of the raw SHA-256 digest.
    const token = createHash("sha256")
      .update(
        `${this.config.cdnTokenKey ?? this.config.tokenKey}${path}${expires}`,
      )
      .digest("base64url");
    return `https://${host}${path}?token=${token}&expires=${expires}`;
  }

  async deleteVideo(videoId: string) {
    const response = await this.request(
      `/videos/${encodeURIComponent(videoId)}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Bunny deleteVideo failed (${response.status})`);
    }
  }
}
