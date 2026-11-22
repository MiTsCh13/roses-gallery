// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/de.json";
import { LibraryVideoActions } from "./library-video-actions";

const ID = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();
const assign = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign },
  });
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  assign.mockReset();
  vi.unstubAllGlobals();
});

const ok = (url: string) =>
  Promise.resolve(new Response(JSON.stringify({ url }), { status: 200 }));

function renderActions() {
  render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <LibraryVideoActions mediaId={ID} />
    </NextIntlClientProvider>,
  );
}

describe("LibraryVideoActions", () => {
  it("fetches a signed player URL only on click and shows it in a dialog", async () => {
    fetchMock.mockReturnValueOnce(ok("https://player.example/v?token=x"));
    renderActions();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ansehen" }));
    const frame = await screen.findByTestId("library-player");
    expect(frame.getAttribute("src")).toBe("https://player.example/v?token=x");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/videos/playback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mediaId: ID }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    await waitFor(() =>
      expect(screen.queryByTestId("library-player")).toBeNull(),
    );
  });

  it("navigates to the signed original URL", async () => {
    fetchMock.mockReturnValueOnce(ok("https://cdn.example/original?token=y"));
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Original laden" }));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        "https://cdn.example/original?token=y",
      ),
    );
    expect(fetchMock.mock.calls[0][0]).toBe("/api/videos/original");
  });

  it("shows an error when the API refuses", async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response("{}", { status: 409 })),
    );
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Original laden" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Video konnte nicht geladen werden.",
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
