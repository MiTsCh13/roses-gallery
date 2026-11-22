import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BlogContentError,
  buildRss,
  getPost,
  listPosts,
  parseFrontmatter,
  showDrafts,
} from "@/lib/blog";
import { siteUrl } from "@/lib/site-url";

const fixtures = path.join(process.cwd(), "src", "test", "fixtures");
const valid = path.join(fixtures, "blog-valid");

const fm = (body: string) => `---\n${body}\n---\n\nText`;

describe("parseFrontmatter", () => {
  it("accepts valid frontmatter and defaults draft to false", () => {
    expect(
      parseFrontmatter(
        fm("title: T\ndescription: D\ndate: 2026-11-22\nauthor: A"),
        "x.mdx",
      ),
    ).toEqual({
      title: "T",
      description: "D",
      date: "2026-11-22",
      author: "A",
      draft: false,
    });
  });

  it.each([
    ["missing frontmatter", "# Nur Text"],
    ["missing date", fm("title: T\ndescription: D\nauthor: A")],
    [
      "invalid date",
      fm("title: T\ndescription: D\ndate: 22.11.2026\nauthor: A"),
    ],
    [
      "draft not boolean",
      fm("title: T\ndescription: D\ndate: 2026-11-22\nauthor: A\ndraft: ja"),
    ],
    [
      "unknown key",
      fm("title: T\ndescription: D\ndate: 2026-11-22\nauthor: A\ntags: [x]"),
    ],
    [
      "external cover",
      fm(
        "title: T\ndescription: D\ndate: 2026-11-22\nauthor: A\ncover: https://x.de/a.jpg",
      ),
    ],
    ["broken yaml", fm("title: [unclosed")],
  ])("rejects %s", (_name, source) => {
    expect(() => parseFrontmatter(source, "x.mdx")).toThrow(BlogContentError);
  });
});

describe("listPosts", () => {
  it("sorts newest first and hides drafts unless requested", () => {
    expect(
      listPosts({ dir: valid, includeDrafts: false }).map((p) => p.slug),
    ).toEqual(["neuer-beitrag", "aelterer-beitrag"]);
    expect(
      listPosts({ dir: valid, includeDrafts: true }).map((p) => p.slug),
    ).toEqual(["entwurf", "neuer-beitrag", "aelterer-beitrag"]);
  });

  it("hides drafts in production only", () => {
    expect(showDrafts("production")).toBe(false);
    expect(showDrafts("development")).toBe(true);
  });

  it("throws on invalid posts so the build fails", () => {
    expect(() =>
      listPosts({ dir: path.join(fixtures, "blog-invalid") }),
    ).toThrow(/kaputt\.mdx.*date/);
  });

  it("returns an empty list for a missing directory", () => {
    expect(listPosts({ dir: path.join(fixtures, "gibt-es-nicht") })).toEqual(
      [],
    );
  });

  it("finds a single post but not drafts in production or bad slugs", () => {
    expect(getPost("neuer-beitrag", { dir: valid })?.title).toBe(
      "Neuer Beitrag",
    );
    expect(getPost("entwurf", { dir: valid, includeDrafts: false })).toBeNull();
    expect(getPost("../etc/passwd", { dir: valid })).toBeNull();
  });

  it("validates the real content directory", () => {
    expect(() => listPosts({ includeDrafts: true })).not.toThrow();
  });
});

describe("buildRss", () => {
  it("produces escaped RSS 2.0 with absolute links", () => {
    const xml = buildRss(listPosts({ dir: valid, includeDrafts: false }), {
      url: "https://roses-gallery.app/",
      title: "Blog",
      description: "Neues",
    });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(
      "<link>https://roses-gallery.app/blog/neuer-beitrag</link>",
    );
    expect(xml).toContain(
      "&quot;Anführungszeichen&quot; &amp; Sonderzeichen &lt;b&gt;",
    );
    expect(xml).toContain("<pubDate>Fri, 20 Nov 2026 00:00:00 GMT</pubDate>");
    expect(xml).not.toContain("Entwurf");
    expect(xml.match(/<item>/g)).toHaveLength(2);
    // wohlgeformt: jedes geöffnete Element wird geschlossen
    for (const tag of ["rss", "channel", "item", "title", "link"]) {
      expect(xml.match(new RegExp(`<${tag}[ >]`, "g"))?.length).toBe(
        xml.match(new RegExp(`</${tag}>`, "g"))?.length,
      );
    }
  });
});

describe("siteUrl", () => {
  it("uses the AUTH_URL origin with a fallback", () => {
    expect(siteUrl({ AUTH_URL: "https://roses-gallery.app/x/" })).toBe(
      "https://roses-gallery.app",
    );
    expect(siteUrl({})).toBe("https://roses-gallery.app");
    expect(siteUrl({ AUTH_URL: "kein url" })).toBe("https://roses-gallery.app");
  });
});
