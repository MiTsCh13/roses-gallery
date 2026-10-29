import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { SYSTEM_THEMES } from "./themes";

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});

describe("system themes (WCAG 2.1 AA)", () => {
  for (const theme of SYSTEM_THEMES) {
    const { background, text, muted } = theme.config.colors;
    it(`${theme.name}: text and muted text reach 4.5:1`, () => {
      expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(muted, background)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
