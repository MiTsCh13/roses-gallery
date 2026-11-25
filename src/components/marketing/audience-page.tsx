import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listPosts } from "@/lib/blog";

export type Audience = "photographers" | "videographers";

/** Pfade der Zielgruppen-Seiten (W2-4); auch für Sitemap und Links. */
export const AUDIENCE_PATHS: Record<Audience, string> = {
  photographers: "/fuer-fotografen",
  videographers: "/fuer-videografen",
};

/** Passende Blogbeiträge; Entwürfe werden nie verlinkt. */
const RELATED_POSTS: Record<Audience, string[]> = {
  photographers: ["galerie-link-statt-dropbox"],
  videographers: [
    "hochzeitsvideos-ohne-qualitaetsverlust-ausliefern",
    "galerie-link-statt-dropbox",
  ],
};

type TextBlock = { title: string; text: string };

export async function audienceMetadata(audience: Audience) {
  const t = await getTranslations(`Audience.${audience}`);
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: AUDIENCE_PATHS[audience] },
  };
}

export async function AudiencePage({ audience }: { audience: Audience }) {
  const [t, tc] = await Promise.all([
    getTranslations(`Audience.${audience}`),
    getTranslations("Audience.common"),
  ]);
  const benefits = t.raw("benefits") as TextBlock[];
  const faq = t.raw("faq") as { q: string; a: string }[];
  const published = listPosts({ includeDrafts: false });
  const posts = RELATED_POSTS[audience]
    .map((slug) => published.find((p) => p.slug === slug))
    .filter((p) => p !== undefined);
  const other: Audience =
    audience === "photographers" ? "videographers" : "photographers";

  return (
    <main className="flex flex-1 flex-col" data-testid={`audience-${audience}`}>
      <section className="bg-gradient-to-b from-accent/60 via-background to-background px-4 py-20 text-center sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          <p className="rounded-full bg-secondary px-4 py-1 text-sm text-secondary-foreground">
            {t("eyebrow")}
          </p>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {t("intro")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/login">{tc("cta")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full"
            >
              <Link href="/preise">{tc("pricing")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="vorteile-titel"
        className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6"
      >
        <h2
          id="vorteile-titel"
          className="text-center font-display text-3xl font-semibold tracking-tight"
        >
          {tc("benefitsTitle")}
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <li
              key={b.title}
              className="rounded-2xl border bg-card p-6 shadow-xs"
            >
              <Check aria-hidden className="size-6 text-primary" />
              <h3 className="mt-3 font-display text-lg font-semibold">
                {b.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="faq-titel"
        className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6"
      >
        <h2
          id="faq-titel"
          className="text-center font-display text-3xl font-semibold tracking-tight"
        >
          {tc("faqTitle")}
        </h2>
        <div className="mt-8 divide-y rounded-2xl border bg-card">
          {faq.map((item) => (
            <details key={item.q} className="px-5 py-4">
              <summary className="cursor-pointer font-medium">{item.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-3xl gap-4 px-4 pb-20 sm:grid-cols-2 sm:px-6">
        {posts.length > 0 && (
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">
              {tc("blogTitle")}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {posts.map((post) => (
                <li key={post.slug}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-2xl border bg-accent/40 p-6">
          <h2 className="font-display text-lg font-semibold">
            {tc("otherTitle")}
          </h2>
          <Link
            href={AUDIENCE_PATHS[other]}
            className="mt-3 inline-block text-sm text-primary underline-offset-2 hover:underline"
          >
            {tc(
              other === "photographers"
                ? "forPhotographers"
                : "forVideographers",
            )}
          </Link>
        </div>
      </section>
    </main>
  );
}
