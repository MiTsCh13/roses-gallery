import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { listPosts } from "@/lib/blog";
import { formatPostDate } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Blog");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      types: { "application/rss+xml": "/blog/rss.xml" },
    },
  };
}

export default async function BlogPage() {
  const t = await getTranslations("Blog");
  const posts = listPosts();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{t("description")}</p>
        <a href="/blog/rss.xml" className="mt-2 inline-block text-sm underline">
          {t("rss")}
        </a>
      </header>
      {posts.length === 0 ? (
        <p className="mt-12 text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-12 flex flex-col gap-6">
          {posts.map((post) => (
            <li key={post.slug} className="rounded-2xl border bg-card p-6">
              <article>
                <h2 className="font-display text-2xl font-semibold">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("byline", {
                    author: post.author,
                    date: formatPostDate(post.date),
                  })}
                  {post.draft ? ` · ${t("draft")}` : null}
                </p>
                <p className="mt-3">{post.description}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
