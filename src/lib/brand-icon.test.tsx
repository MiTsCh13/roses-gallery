// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BRAND_BLADES, BrandMark } from "@/components/brand-mark";
import { brandTileSvg } from "./brand-icon";

afterEach(cleanup);

describe("brand mark (D-161)", () => {
  it("draws six aperture blades, decorative only", () => {
    const { getByTestId } = render(<BrandMark className="size-7" />);
    const svg = getByTestId("brand-mark");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelectorAll("path")).toHaveLength(6);
    expect(BRAND_BLADES).toHaveLength(6);
  });

  it("keeps the committed favicon in sync with the mark", () => {
    expect(readFileSync("src/app/icon.svg", "utf8").trim()).toBe(
      brandTileSvg(),
    );
  });
});
