// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import messages from "../../../messages/de.json";
import { SYSTEM_THEMES } from "@/lib/themes";
import { GalleryView } from "./gallery-view";
import { formatDuration } from "./video-shelf";

const sets = [
  {
    id: "s1",
    title: "Highlight",
    tiles: [],
    videos: [
      { id: "a", title: "Film 1", playUrl: "https://v.test/a", durationS: 95 },
      {
        id: "b",
        title: "Film 2",
        playUrl: "https://v.test/b",
        durationS: 3700,
      },
    ],
  },
  {
    id: "s2",
    title: "Fotos",
    tiles: [{ id: "p", src: "https://x.test/p.webp" }],
  },
];

function renderView() {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <GalleryView config={SYSTEM_THEMES[0].config} title="T" sets={sets} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("VideoShelf", () => {
  it("formats durations", () => {
    expect(formatDuration(95)).toBe("1:35");
    expect(formatDuration(3700)).toBe("1:01:40");
  });

  it("renders a hybrid gallery: video rows plus photo grid", () => {
    renderView();
    expect(screen.getAllByTestId("video-tile")).toHaveLength(2);
    expect(screen.getAllByTestId("gallery-tile")).toHaveLength(1);
  });

  it("does not load the player before play and swaps the hero on tile click", () => {
    const { container } = renderView();
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Film 1 abspielen/ }));
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://v.test/a",
    );
    fireEvent.click(screen.getAllByTestId("video-tile")[1]);
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://v.test/b",
    );
  });
});
