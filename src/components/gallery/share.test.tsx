// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/de.json";
import { ShareLinkButton, StoryShareButton } from "./share";

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="de" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.assign(navigator, { share: undefined, canShare: undefined });
});

describe("ShareLinkButton", () => {
  it("uses the share sheet with an absolute URL when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    wrap(<ShareLinkButton path="/g/anna-ben" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Galerie-Link teilen" }),
    );
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].url).toMatch(/^https?:\/\/.+\/g\/anna-ben$/);
  });

  it("falls back to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    wrap(<ShareLinkButton path="/g/anna-ben" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Galerie-Link teilen" }),
    );
    await screen.findByText("Link kopiert.");
    expect(writeText).toHaveBeenCalled();
  });
});

describe("StoryShareButton", () => {
  const stubFetch = (ok: boolean) =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok,
        blob: async () => new Blob(["x"], { type: "image/jpeg" }),
      }),
    );

  it("shares the image as a file when the browser can", async () => {
    stubFetch(true);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    wrap(<StoryShareButton url="/api/g/a/story/1" fileName="a.jpg" />);
    fireEvent.click(screen.getByRole("button", { name: "Als Story teilen" }));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    const file = share.mock.calls[0][0].files[0] as File;
    expect([file.name, file.type]).toEqual(["a.jpg", "image/jpeg"]);
  });

  it("reports a failed render", async () => {
    stubFetch(false);
    wrap(<StoryShareButton url="/api/g/a/story/1" fileName="a.jpg" />);
    fireEvent.click(screen.getByRole("button", { name: "Als Story teilen" }));
    await screen.findByText("Das Bild konnte nicht erstellt werden.");
  });
});
