// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { readResume, writeResume } from "./resume-position";

describe("resume position", () => {
  beforeEach(() => localStorage.clear());

  it("stores and restores a mid-film position", () => {
    writeResume("v1", 62.7, 600);
    expect(readResume("v1", 600)).toBe(62);
  });

  it("ignores positions near the start or the end and clears them", () => {
    writeResume("v1", 120, 600);
    writeResume("v1", 598, 600);
    expect(readResume("v1", 600)).toBe(0);
    expect(localStorage.getItem("roses:resume:v1")).toBeNull();
  });

  it("returns 0 for unknown or corrupt values", () => {
    expect(readResume("none", 600)).toBe(0);
    localStorage.setItem("roses:resume:x", "abc");
    expect(readResume("x", 600)).toBe(0);
  });
});
