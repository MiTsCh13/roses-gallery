// Blogbeiträge als MDX in content/blog/<slug>.mdx mit YAML-Frontmatter.
// Die Frontmatter wird hier per Zod geprüft; ein ungültiger Beitrag wirft,
// damit der Build (generateStaticParams, Liste, RSS) abbricht.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const BLOG_DIR = path.join(process.cwd(), "content", "blog");

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const frontmatterSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(300),
    date: z.iso.date(),
    author: z.string().trim().min(1).max(80),
    draft: z.boolean().default(false),
    cover: z
      .string()
      .regex(/^\/[^\s]+$/, "cover muss ein Pfad unter /public sein")
      .optional(),
  })
  .strict();

export type Frontmatter = z.infer<typeof frontmatterSchema>;
export type PostMeta = Frontmatter & { slug: string };

export class BlogContentError extends Error {
  constructor(file: string, detail: string) {
    super(`Ungültiger Blogbeitrag ${file}: ${detail}`);
    this.name = "BlogContentError";
  }
}

/** Liest die YAML-Frontmatter (zwischen `---`-Zeilen am Dateianfang). */
export function parseFrontmatter(source: string, file: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) throw new BlogContentError(file, "Frontmatter fehlt");
  let data: unknown;
  try {
    data = parseYaml(match[1], { schema: "core" });
  } catch (error) {
    throw new BlogContentError(file, (error as Error).message);
  }
  // Core-Schema: `2026-11-22` bleibt ein String (kein YAML-1.1-Timestamp).
  const result = frontmatterSchema.safeParse(data);
  if (!result.success) {
    throw new BlogContentError(
      file,
      result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    );
  }
  return result.data;
}

export function showDrafts(env: string | undefined = process.env.NODE_ENV) {
  return env !== "production";
}

/** Alle Beiträge, neueste zuerst; Entwürfe nur außerhalb der Produktion. */
export function listPosts(
  options: { dir?: string; includeDrafts?: boolean } = {},
): PostMeta[] {
  const dir = options.dir ?? BLOG_DIR;
  const includeDrafts = options.includeDrafts ?? showDrafts();
  let files: string[];
  try {
    files = readdirSync(/*turbopackIgnore: true*/ dir).filter((f) =>
      f.endsWith(".mdx"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const posts = files.map((file) => {
    const slug = file.slice(0, -".mdx".length);
    if (!SLUG.test(slug)) {
      throw new BlogContentError(file, "Dateiname ist kein gültiger Slug");
    }
    const meta = parseFrontmatter(
      readFileSync(path.join(/*turbopackIgnore: true*/ dir, file), "utf8"),
      file,
    );
    return { ...meta, slug };
  });
  return posts
    .filter((p) => includeDrafts || !p.draft)
    .sort((a, b) =>
      a.date === b.date
        ? a.slug.localeCompare(b.slug)
        : b.date.localeCompare(a.date),
    );
}

export function getPost(
  slug: string,
  options: { dir?: string; includeDrafts?: boolean } = {},
): PostMeta | null {
  if (!SLUG.test(slug)) return null;
  return listPosts(options).find((p) => p.slug === slug) ?? null;
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** RSS 2.0 für die übergebenen Beiträge. */
export function buildRss(
  posts: PostMeta[],
  site: { url: string; title: string; description: string },
): string {
  const base = site.url.replace(/\/$/, "");
  const items = posts
    .map((p) => {
      const link = `${base}/blog/${p.slug}`;
      return [
        "    <item>",
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <description>${escapeXml(p.description)}</description>`,
        `      <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(site.title)}</title>`,
    `    <link>${escapeXml(`${base}/blog`)}</link>`,
    `    <description>${escapeXml(site.description)}</description>`,
    "    <language>de-DE</language>",
    `    <atom:link href="${escapeXml(`${base}/blog/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n")
    .concat("\n");
}
