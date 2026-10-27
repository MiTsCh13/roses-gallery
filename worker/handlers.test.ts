import { describe, expect, it } from "vitest";

import { dispatch } from "./handlers";

describe("dispatch", () => {
  it("runs the handler for a known job", async () => {
    const requestedAt = "2026-10-27T10:00:00.000Z";
    await expect(dispatch("ping", { requestedAt })).resolves.toEqual({
      pong: true,
      requestedAt,
    });
  });

  it("rejects unknown jobs", async () => {
    await expect(dispatch("nope", {})).rejects.toThrow("Unknown job: nope");
  });

  it("rejects invalid payloads before the handler runs", async () => {
    await expect(dispatch("ping", { requestedAt: 42 })).rejects.toThrow();
  });
});
