import { describe, expect, it } from "vitest";

import { allowMagicLinkRequest } from "./login-limit";
import { MemoryRateLimiter } from "./rate-limit";

describe("allowMagicLinkRequest", () => {
  it("blocks the 6th request for the same e-mail, case-insensitively", async () => {
    const l = new MemoryRateLimiter();
    for (let i = 0; i < 5; i++)
      expect(await allowMagicLinkRequest(l, "A@b.de", `ip${i}`)).toBe(true);
    expect(await allowMagicLinkRequest(l, "a@B.de", "ip9")).toBe(false);
    expect(await allowMagicLinkRequest(l, "other@b.de", "ip9")).toBe(true);
  });

  it("blocks the 21st request from one IP", async () => {
    const l = new MemoryRateLimiter();
    for (let i = 0; i < 20; i++)
      expect(await allowMagicLinkRequest(l, `u${i}@b.de`, "1.2.3.4")).toBe(
        true,
      );
    expect(await allowMagicLinkRequest(l, "new@b.de", "1.2.3.4")).toBe(false);
  });
});
