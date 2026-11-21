// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/de.json";
import { ShareLinkButton, PhotoShareButton } from "./share";

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

describe("PhotoShareButton", () => {
  const stubFetch = (ok: boolean) =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok,
        blob: async () => new Blob(["x"], { type: "image/webp" }),
      }),
    );

  it("shares the photo as a file when the browser can", async () => {
    stubFetch(true);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    wrap(<PhotoShareButton url="/api/g/a/download/1" fileName="a.webp" />);
    fireEvent.click(screen.getByRole("button", { name: "Teilen" }));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    const file = share.mock.calls[0][0].files[0] as File;
    expect([file.name, file.type]).toEqual(["a.webp", "image/webp"]);
  });

  it("falls back to the gallery link where files cannot be shared", async () => {
    stubFetch(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    wrap(<PhotoShareButton url="/api/g/a/download/1" fileName="a.webp" />);
    fireEvent.click(screen.getByRole("button", { name: "Teilen" }));
    await screen.findByText("Link kopiert.");
    expect(writeText).toHaveBeenCalled();
  });

  it("reports a failed download", async () => {
    stubFetch(false);
    Object.assign(navigator, { canShare: () => true });
    wrap(<PhotoShareButton url="/api/g/a/download/1" fileName="a.webp" />);
    fireEvent.click(screen.getByRole("button", { name: "Teilen" }));
    await screen.findByText("Das Foto konnte nicht geteilt werden.");
  });
});
