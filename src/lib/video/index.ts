import { serverEnv } from "@/lib/env";
import { BunnyVideoProvider } from "./bunny";
import { FakeVideoProvider } from "./fake";
import type { VideoProvider } from "./types";

const globalForVideo = globalThis as unknown as { video?: VideoProvider };

export function getVideoProvider(): VideoProvider {
  if (globalForVideo.video) return globalForVideo.video;
  const env = serverEnv();
  const transport =
    env.VIDEO_TRANSPORT ?? (env.BUNNY_STREAM_API_KEY ? "bunny" : "fake");
  if (transport === "fake") {
    if (env.NODE_ENV === "production" && env.E2E_TEST_MODE !== "1") {
      throw new Error(
        "The fake video provider must not be used in production.",
      );
    }
    globalForVideo.video = new FakeVideoProvider();
  } else {
    if (
      !env.BUNNY_STREAM_LIBRARY_ID ||
      !env.BUNNY_STREAM_API_KEY ||
      !env.BUNNY_STREAM_TOKEN_KEY
    ) {
      throw new Error(
        "BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY and BUNNY_STREAM_TOKEN_KEY are required.",
      );
    }
    globalForVideo.video = new BunnyVideoProvider({
      libraryId: env.BUNNY_STREAM_LIBRARY_ID,
      apiKey: env.BUNNY_STREAM_API_KEY,
      tokenKey: env.BUNNY_STREAM_TOKEN_KEY,
      cdnHostname: env.BUNNY_STREAM_CDN_HOSTNAME,
      cdnTokenKey: env.BUNNY_STREAM_CDN_TOKEN_KEY,
    });
  }
  return globalForVideo.video;
}

export * from "./types";
