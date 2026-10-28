// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/de.json";
import { HlsPlayer } from "./hls-player";

vi.mock("hls.js", () => ({
  default: class {
    static isSupported = () => false;
  },
}));

afterEach(() => {
  cleanup();
  delete (HTMLMediaElement.prototype as { remote?: unknown }).remote;
});

function renderPlayer() {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <HlsPlayer videoId="v1" src="https://v.test/p.m3u8" title="Film 1" />
    </NextIntlClientProvider>,
  );
}

describe("HlsPlayer cast button", () => {
  it("is hidden without cast support", async () => {
    renderPlayer();
    await waitFor(() => screen.getByTestId("hls-video"));
    expect(screen.queryByTestId("hls-cast")).toBeNull();
  });

  it("opens the Remote Playback prompt when supported", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "remote", {
      configurable: true,
      value: { prompt },
    });
    renderPlayer();
    (await screen.findByTestId("hls-cast")).click();
    await waitFor(() => expect(prompt).toHaveBeenCalled());
  });
});
