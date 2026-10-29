import { describe, expect, it } from "vitest";
import { tokenAppender } from "./hls-token";

const src =
  "https://cdn.example.net/vid/playlist.m3u8?token=abc&expires=99&token_path=%2Fvid%2F";

describe("tokenAppender", () => {
  const add = tokenAppender(src);

  it("adds the signed query to variant playlists and segments", () => {
    const url = new URL(add("https://cdn.example.net/vid/360p/video.m3u8"));
    expect(url.searchParams.get("token")).toBe("abc");
    expect(url.searchParams.get("expires")).toBe("99");
    expect(url.searchParams.get("token_path")).toBe("/vid/");
  });

  it("keeps existing query parameters", () => {
    const url = new URL(add("https://cdn.example.net/vid/360p/seg0.ts?x=1"));
    expect(url.searchParams.get("x")).toBe("1");
    expect(url.searchParams.get("token")).toBe("abc");
  });

  it("leaves URLs that already carry a token or point elsewhere", () => {
    expect(add(src)).toBe(src);
    expect(add("https://other.example.net/a.ts")).toBe(
      "https://other.example.net/a.ts",
    );
  });

  it("does nothing for unsigned sources", () => {
    const plain = "https://cdn.example.net/vid/360p/video.m3u8";
    expect(
      tokenAppender("https://cdn.example.net/vid/playlist.m3u8")(plain),
    ).toBe(plain);
  });
});
