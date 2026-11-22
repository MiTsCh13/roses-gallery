import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getPost, listPosts } from "@/lib/blog";
import { formatPostDate } from "@/lib/format";

// Unbekannte Slugs (und Entwürfe in Produktion) liefern 404 über getPost.
// Ohne veröffentlichten Beitrag braucht der Build trotzdem einen Pfad;
// der Platzhalter liefert ebenfalls 404.
const NO_POSTS = "_";

export function generateStaticParams() {
  const posts = listPosts();
  return posts.length > 0
    ? posts.map((post) => ({ slug: post.slug }))
    : [{ slug: NO_POSTS }];
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const t = await getTranslations("Blog");
  const { default: Content } = await import(
    `../../../../../content/blog/${post.slug}.mdx`
  );
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <article>
        <header>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-primary">
            {post.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("byline", {
              author: post.author,
              date: formatPostDate(post.date),
            })}
            {post.draft ? ` · ${t("draft")}` : null}
          </p>
          {post.cover ? (
            <Image
              src={post.cover}
              alt=""
              width={1200}
              height={630}
              priority
              className="mt-8 h-auto w-full rounded-2xl"
            />
          ) : null}
        </header>
        <div className="mt-8">
          <Content />
        </div>
      </article>
      <Link href="/blog" className="mt-12 inline-block text-sm underline">
        {t("back")}
      </Link>
    </main>
  );
}
