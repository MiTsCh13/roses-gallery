// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { detectCast, promptCast } from "./cast";

function video(extra: object = {}) {
  return Object.assign(document.createElement("video"), extra);
}

describe("cast", () => {
  it("detects nothing without support", () => {
    expect(detectCast(video())).toBeNull();
  });

  it("prefers the Remote Playback API", () => {
    const v = video({
      remote: { prompt: vi.fn().mockResolvedValue(undefined) },
      webkitShowPlaybackTargetPicker: vi.fn(),
    });
    expect(detectCast(v)).toBe("remote");
  });

  it("falls back to the WebKit picker", () => {
    const pick = vi.fn();
    const v = video({ webkitShowPlaybackTargetPicker: pick });
    expect(detectCast(v)).toBe("airplay");
    void promptCast(v, "airplay");
    expect(pick).toHaveBeenCalled();
  });

  it("swallows a dismissed prompt", async () => {
    const v = video({
      remote: { prompt: vi.fn().mockRejectedValue(new Error("dismissed")) },
    });
    await expect(promptCast(v, "remote")).resolves.toBeUndefined();
  });
});
