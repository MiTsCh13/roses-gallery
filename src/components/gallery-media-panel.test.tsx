// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/de.json";

const reorder = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/app/dashboard/galleries/actions", () => ({
  addGalleryMediaAction: vi.fn(),
  removeGalleryMediaAction: vi.fn(),
  setGalleryCoverAction: vi.fn(),
  reorderGalleryMediaAction: reorder,
}));

import { GalleryMediaPanel } from "./gallery-media-panel";

afterEach(() => {
  cleanup();
  reorder.mockClear();
});

const items = ["a", "b", "c"].map((id) => ({ id, type: "photo" as const }));

function setup() {
  render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <GalleryMediaPanel
        galleryId="g1"
        coverMediaId={null}
        inGallery={items}
        addable={[]}
      />
    </NextIntlClientProvider>,
  );
}

const order = () =>
  [...screen.getByTestId("gallery-media").querySelectorAll("li")].map(
    (li) => li.dataset.mediaId,
  );

describe("GalleryMediaPanel order", () => {
  it("moves a marked item later and persists the order", async () => {
    setup();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Später" }));
    await vi.waitFor(() =>
      expect(reorder).toHaveBeenCalledWith("g1", ["b", "a", "c"]),
    );
    expect(order()).toEqual(["b", "a", "c"]);
  });

  it("reorders by dragging an item onto another", async () => {
    setup();
    const lis = screen.getByTestId("gallery-media").querySelectorAll("li");
    fireEvent.dragStart(lis[2]);
    fireEvent.drop(lis[0]);
    await vi.waitFor(() =>
      expect(reorder).toHaveBeenCalledWith("g1", ["c", "a", "b"]),
    );
  });

  it("disables the move buttons without a single selection", () => {
    setup();
    expect(
      (screen.getByRole("button", { name: "Früher" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
