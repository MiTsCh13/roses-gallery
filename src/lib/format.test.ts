import { describe, expect, it } from "vitest";

import { formatBytes, formatEuro } from "./format";

describe("formatEuro", () => {
  it("formats cent integers in German notation", () => {
    expect(formatEuro(1400)).toBe("14 €");
    expect(formatEuro(1490)).toBe("14,90 €");
  });
});

describe("formatBytes", () => {
  it("picks a readable unit", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(2 * 1024 ** 3)).toBe("2 GB");
    expect(formatBytes(600 * 1024 ** 3)).toBe("600 GB");
  });
});
