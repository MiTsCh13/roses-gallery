import { describe, expect, it } from "vitest";

import type { PostMeta } from "@/lib/blog";
import { PLANS } from "@/lib/plans";
import {
  buildRobots,
  buildSitemap,
  buildStructuredData,
  jsonLd,
  PRIVATE_PATHS,
} from "@/lib/seo";

const base = "https://roses-gallery.app";
const post = (slug: string, draft = false): PostMeta => ({
  slug,
  title: slug,
  description: "d",
  date: "2026-11-20",
  author: "a",
  draft,
});

describe("buildSitemap", () => {
  it("lists website pages and published posts only", () => {
    const urls = buildSitemap(base, [post("live"), post("entwurf", true)]).map(
      (e) => e.url,
    );
    expect(urls).toEqual([
      base,
      `${base}/preise`,
      `${base}/blog`,
      `${base}/impressum`,
      `${base}/datenschutz`,
      `${base}/agb`,
      `${base}/blog/live`,
    ]);
    for (const url of urls) {
      for (const p of PRIVATE_PATHS) expect(url).not.toContain(`${base}${p}`);
    }
  });
});

describe("buildRobots", () => {
  it("allows the website and blocks app, api, galleries and login", () => {
    const robots = buildRobots(base);
    expect(robots.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/g/", "/login"],
    });
    expect(robots.sitemap).toBe(`${base}/sitemap.xml`);
  });
});

describe("buildStructuredData", () => {
  it("publishes prices straight from plans.ts", () => {
    const [org, app] = buildStructuredData(base, "Galerien");
    expect(org).toMatchObject({ "@type": "Organization", url: base });
    expect(app["@type"]).toBe("SoftwareApplication");
    const offers = (app as { offers: { name: string; price: string }[] })
      .offers;
    expect(offers.map((o) => [o.name, o.price])).toEqual([
      ["Free", "0.00"],
      ...(["bud", "bloom", "bouquet"] as const).map((id) => [
        PLANS[id].name,
        (PLANS[id].priceMonthlyCents! / 100).toFixed(2),
      ]),
    ]);
  });

  it("escapes markup in JSON-LD", () => {
    expect(jsonLd({ x: "</script><script>" })).not.toContain("</script>");
  });
});
