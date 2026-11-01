// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import messages from "../../../messages/de.json";
import { SYSTEM_THEMES } from "@/lib/themes";
import { DesignFields } from "./design-fields";
import { EditorState } from "./editor-state";
import { LivePreview } from "./live-preview";
import { TitleField } from "./title-field";

afterEach(cleanup);

function setup() {
  const themes = SYSTEM_THEMES.map((t, i) => ({
    id: `t${i}`,
    name: t.name,
    config: t.config,
  }));
  render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <EditorState
        initialTitle="Anna & Ben"
        initialThemeId="t0"
        initialConfig={themes[0].config}
        themes={themes}
      >
        <TitleField form="f" />
        <DesignFields
          form="f"
          galleryId="g"
          removeLogoAction={async () => {}}
        />
        <LivePreview
          coverUrl="/cover.jpg"
          openHref="/g/anna-ben"
          tiles={[{ id: "p1" }]}
        />
      </EditorState>
    </NextIntlClientProvider>,
  );
  return themes;
}

describe("live preview", () => {
  it("follows the title, the theme and the cover style", () => {
    const themes = setup();
    const view = screen.getByTestId("gallery-view");
    expect(view.textContent).toContain("Anna & Ben");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Lena & Tom" },
    });
    expect(view.textContent).toContain("Lena & Tom");

    const other = themes.find(
      (t) => t.config.grid.layout !== themes[0].config.grid.layout,
    )!;
    fireEvent.change(screen.getByLabelText("Theme"), {
      target: { value: other.id },
    });
    expect(view.getAttribute("data-layout")).toBe(other.config.grid.layout);
    expect(
      screen.getByRole("link", { name: /Vorschau im neuen Tab/ }),
    ).toHaveProperty("target", "_blank");
  });

  it("stores theme and design with the main form", () => {
    setup();
    const config = document.querySelector<HTMLInputElement>(
      'input[name="config"][form="f"]',
    )!;
    expect(JSON.parse(config.value).grid.layout).toBeTruthy();
    expect(
      document.querySelector('input[name="themeId"][form="f"]'),
    ).toHaveProperty("value", "t0");
  });
});
