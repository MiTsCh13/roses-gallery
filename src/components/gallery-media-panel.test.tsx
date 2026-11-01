// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/de.json";

const del = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const add = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const upVideo = vi.hoisted(() =>
  vi
    .fn()
    .mockResolvedValue({ mediaId: "11111111-1111-4111-8111-111111111111" }),
);
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/video-upload-client", () => ({ uploadVideoFile: upVideo }));
const reorder = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/app/dashboard/galleries/actions", () => ({
  addGalleryMediaAction: add,
  deleteGalleryMediaAction: del,
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

describe("GalleryMediaPanel delete", () => {
  it("deletes marked media for good only after confirmation", async () => {
    setup();
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const btn = screen.getByRole("button", { name: "1 endgültig löschen" });
    fireEvent.click(btn);
    expect(del).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(btn);
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith("g1", ["b"]));
    confirm.mockRestore();
  });
});

describe("Upload in die Galerie", () => {
  it("lädt per Datei-Auswahl hoch und fügt das Medium der Galerie hinzu", async () => {
    setup();
    const file = new File(["x"], "film.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByTestId("gallery-file-input"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith("g1", [
        "11111111-1111-4111-8111-111111111111",
      ]),
    );
    await screen.findByText("Hinzugefügt");
    expect(refresh).toHaveBeenCalled();
  });

  it("zeigt einen Fehler, wenn der Upload scheitert", async () => {
    upVideo.mockRejectedValueOnce(new Error("failed"));
    setup();
    const file = new File(["x"], "film.mp4", { type: "video/mp4" });
    fireEvent.drop(screen.getByTestId("media-dropzone"), {
      dataTransfer: { files: [file], types: ["Files"] },
    });
    await screen.findByText("Fehlgeschlagen");
  });
});
