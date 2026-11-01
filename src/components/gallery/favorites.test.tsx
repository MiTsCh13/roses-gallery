// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/de.json";
import { SYSTEM_THEMES } from "@/lib/themes";
import type { FavoritesState } from "@/lib/favorites";
import { FavoritesPanel, FavoritesProvider } from "./favorites";
import { GalleryGrid } from "./gallery-grid";

const actions = vi.hoisted(() => ({
  toggleFavoriteAction: vi.fn(),
  createListAction: vi.fn(),
  deleteListAction: vi.fn(),
  sendListAction: vi.fn(),
  emailLinkAction: vi.fn(),
}));
vi.mock("@/app/g/[slug]/favorites-actions", () => actions);

const tiles = [
  { id: "a", src: "https://x.test/a.webp", alt: "Foto 1" },
  { id: "b", src: "https://x.test/b.webp", alt: "Foto 2" },
];
const withA: FavoritesState = {
  hasEmail: false,
  lists: [{ id: "l1", name: "Favoriten", mediaIds: ["a"] }],
};

function renderAll(initial: FavoritesState) {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <FavoritesProvider slug="anna-ben" initial={initial}>
        <GalleryGrid
          layout={SYSTEM_THEMES[0].config.grid.layout}
          tiles={tiles}
        />
        <FavoritesPanel />
      </FavoritesProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("favorites UI", () => {
  it("filters the grid to favorites, videos included", () => {
    const withVideo = [
      ...tiles,
      {
        id: "v",
        video: { title: "Video 1", posterUrl: "https://x.test/p.jpg" },
      },
    ];
    render(
      <NextIntlClientProvider locale="de" messages={messages}>
        <FavoritesProvider
          slug="anna-ben"
          initial={{
            hasEmail: false,
            lists: [{ id: "l1", name: "Favoriten", mediaIds: ["a", "v"] }],
          }}
        >
          <GalleryGrid
            layout={SYSTEM_THEMES[0].config.grid.layout}
            tiles={withVideo}
          />
        </FavoritesProvider>
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByTestId("gallery-tile")).toHaveLength(3);
    expect(screen.getByTestId("video-poster")).toBeTruthy();
    // the video tile has a heart as well
    expect(screen.getAllByTestId("favorite-button")).toHaveLength(3);
    fireEvent.click(screen.getByTestId("favorites-filter"));
    expect(screen.getAllByTestId("gallery-tile")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("favorites-filter"));
    expect(screen.getAllByTestId("gallery-tile")).toHaveLength(3);
  });

  it("shows a hint when the filter matches nothing", () => {
    renderAll({ hasEmail: false, lists: [] });
    fireEvent.click(screen.getByTestId("favorites-filter"));
    expect(screen.queryAllByTestId("gallery-tile")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toContain("Noch keine");
  });

  it("marks favorites and toggles through the server action", async () => {
    actions.toggleFavoriteAction.mockResolvedValue({
      state: {
        hasEmail: false,
        lists: [{ id: "l1", name: "Favoriten", mediaIds: ["a", "b"] }],
      },
    });
    renderAll(withA);
    const hearts = screen.getAllByTestId("favorite-button");
    expect(hearts.map((h) => h.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
    ]);
    fireEvent.click(hearts[1]);
    await screen.findByText("Favoriten (2)");
    expect(actions.toggleFavoriteAction).toHaveBeenCalledWith(
      "anna-ben",
      "b",
      "l1",
    );
    expect(
      screen
        .getAllByTestId("favorite-button")
        .map((h) => h.getAttribute("aria-pressed")),
    ).toEqual(["true", "true"]);
  });

  it("creates lists, sends the active one and asks for a magic link", async () => {
    actions.createListAction.mockResolvedValue({
      state: {
        hasEmail: false,
        lists: [...withA.lists, { id: "l2", name: "Album", mediaIds: [] }],
      },
    });
    actions.sendListAction.mockResolvedValue({ state: withA, code: "sent" });
    actions.emailLinkAction.mockResolvedValue({
      state: { ...withA, hasEmail: true },
      code: "link_sent",
    });
    renderAll(withA);

    fireEvent.change(screen.getByLabelText("Neue Liste (z. B. Album)"), {
      target: { value: "Album" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Liste anlegen" }));
    await screen.findByText("Album (0)");
    expect(actions.createListAction).toHaveBeenCalledWith("anna-ben", "Album");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Aktuelle Liste an den Fotografen senden",
      }),
    );
    await screen.findByText("Die Liste wurde an den Fotografen gesendet.");
    expect(actions.sendListAction).toHaveBeenCalledWith("anna-ben", "l1");

    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), {
      target: { value: "paar@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Link senden" }));
    await screen.findByText("Wir haben dir den Link per E-Mail geschickt.");
    expect(actions.emailLinkAction).toHaveBeenCalledWith(
      "anna-ben",
      "paar@example.com",
    );
  });

  it("renders nothing without a provider (editor preview)", () => {
    render(
      <NextIntlClientProvider locale="de" messages={messages}>
        <GalleryGrid
          layout={SYSTEM_THEMES[0].config.grid.layout}
          tiles={tiles}
        />
        <FavoritesPanel />
      </NextIntlClientProvider>,
    );
    expect(screen.queryAllByTestId("favorite-button")).toHaveLength(0);
    expect(screen.queryByText("Deine Favoriten")).toBeNull();
  });
});
