import { describe, expect, it } from "vitest";

import { wwwRedirects } from "./www-redirect";

describe("wwwRedirects", () => {
  const [rule] = wwwRedirects();
  const host = new RegExp(`^${(rule.has![0] as { value: string }).value}$`);

  it("matches only www hosts and captures the apex domain", () => {
    expect(host.exec("www.roses-gallery.app")?.groups?.domain).toBe(
      "roses-gallery.app",
    );
    expect(host.test("roses-gallery.app")).toBe(false);
    expect(host.test("app.roses-gallery.app")).toBe(false);
  });

  it("redirects permanently to https and keeps the path", () => {
    expect(rule).toMatchObject({
      source: "/:path*",
      destination: "https://:domain/:path*",
      permanent: true,
    });
  });
});
