import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BunnyVideoProvider, mapBunnyStatus } from "./bunny";

const provider = new BunnyVideoProvider({
  libraryId: "123",
  apiKey: "api-key",
  tokenKey: "token-key",
});
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

afterEach(() => vi.unstubAllGlobals());

describe("BunnyVideoProvider", () => {
  it("maps Bunny status codes", () => {
    expect(mapBunnyStatus(0)).toBe("pending");
    expect([1, 2, 3].map(mapBunnyStatus)).toEqual(Array(3).fill("processing"));
    expect(mapBunnyStatus(4)).toBe("ready");
    expect([5, 6].map(mapBunnyStatus)).toEqual(["failed", "failed"]);
  });

  it("signs the tus upload with sha256(library+key+expire+video)", async () => {
    const tus = await provider.createTusUpload("vid", 60);
    expect(tus.endpoint).toBe("https://video.bunnycdn.com/tusupload");
    expect(tus.headers).toMatchObject({ VideoId: "vid", LibraryId: "123" });
    expect(tus.headers.AuthorizationSignature).toBe(
      sha(`123api-key${tus.expiresAt}vid`),
    );
    expect(tus.headers.AuthorizationExpire).toBe(String(tus.expiresAt));
  });

  it("builds a token-signed embed URL without leaking the keys", () => {
    const url = new URL(provider.signPlaybackUrl("vid", 60));
    const expires = url.searchParams.get("expires")!;
    expect(url.pathname).toBe("/embed/123/vid");
    expect(url.searchParams.get("token")).toBe(sha(`token-keyvid${expires}`));
    expect(url.href).not.toContain("api-key");
  });

  it("signs the original URL with the CDN path token", () => {
    const cdn = new BunnyVideoProvider({
      libraryId: "123",
      apiKey: "api-key",
      tokenKey: "token-key",
      cdnHostname: "vz-test.b-cdn.net",
    });
    const url = new URL(cdn.signOriginalUrl("vid", 60));
    const expires = url.searchParams.get("expires")!;
    expect(url.host).toBe("vz-test.b-cdn.net");
    expect(url.pathname).toBe("/vid/original");
    expect(url.searchParams.get("token")).toBe(
      createHash("sha256")
        .update(`token-key/vid/original${expires}`)
        .digest("base64url"),
    );
    expect(() => provider.signOriginalUrl("vid", 60)).toThrow("CDN_HOSTNAME");
  });

  it("prefers the dedicated CDN token key for original URLs", () => {
    const cdn = new BunnyVideoProvider({
      libraryId: "123",
      apiKey: "api-key",
      tokenKey: "token-key",
      cdnHostname: "vz-test.b-cdn.net",
      cdnTokenKey: "cdn-key",
    });
    const url = new URL(cdn.signOriginalUrl("vid", 60));
    const expires = url.searchParams.get("expires")!;
    expect(url.searchParams.get("token")).toBe(
      createHash("sha256")
        .update(`cdn-key/vid/original${expires}`)
        .digest("base64url"),
    );
  });

  it("creates, reads and deletes videos via the API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ guid: "g-1" }))
      .mockResolvedValueOnce(
        Response.json({ status: 4, length: 12.6, width: 3840, height: 2160 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await provider.createVideo("T")).toEqual({ videoId: "g-1" });
    expect(await provider.getVideo("g-1")).toEqual({
      status: "ready",
      durationS: 13,
      width: 3840,
      height: 2160,
    });
    expect(await provider.getVideo("gone")).toBeNull();
    await provider.deleteVideo("gone");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://video.bunnycdn.com/library/123/videos");
    expect(init.headers.AccessKey).toBe("api-key");
  });

  it("throws on API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
    await expect(provider.createVideo("T")).rejects.toThrow("500");
  });
});
