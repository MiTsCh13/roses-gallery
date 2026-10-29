import { describe, expect, it } from "vitest";

import { buildCsp } from "./csp";

describe("buildCsp", () => {
  it("sperrt Einbettung, Plugins und fremde Formularziele", () => {
    const csp = buildCsp(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-src https://iframe.mediadelivery.net");
  });

  it("erlaubt unsafe-eval und WebSockets nur in der Entwicklung", () => {
    expect(buildCsp(false)).not.toContain("unsafe-eval");
    expect(buildCsp(false)).not.toContain("ws:");
    expect(buildCsp(false)).toContain("upgrade-insecure-requests");
    expect(buildCsp(true)).toContain("'unsafe-eval'");
    expect(buildCsp(true)).not.toContain("upgrade-insecure-requests");
  });
});
