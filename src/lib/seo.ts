// SEO-Bausteine der Website: Sitemap, robots.txt, JSON-LD. Alles rein,
// damit es ohne Next-Laufzeit testbar ist.
import type { MetadataRoute } from "next";

import type { PostMeta } from "@/lib/blog";
import { PLANS, PURCHASABLE_PLAN_IDS } from "@/lib/plans";

export const SITE_NAME = "Roses Gallery";

/** Öffentliche Website-Seiten (ohne Blogbeiträge). */
export const WEBSITE_PATHS = [
  "/",
  "/preise",
  "/blog",
  "/impressum",
  "/datenschutz",
  "/agb",
] as const;

/** Nie indexieren: App, API, Kundengalerien, Login. */
export const PRIVATE_PATHS = ["/dashboard", "/api", "/g/", "/login"] as const;

export function buildSitemap(
  base: string,
  posts: PostMeta[],
): MetadataRoute.Sitemap {
  const pages = WEBSITE_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path === "/blog" ? ("weekly" as const) : undefined,
    priority: path === "/" ? 1 : undefined,
  }));
  const blog = posts
    .filter((post) => !post.draft)
    .map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: post.date,
    }));
  return [...pages, ...blog];
}

export function buildRobots(base: string): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_PATHS],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

/** JSON-LD für die Startseite: Organisation + Software mit Preisen aus plans.ts. */
export function buildStructuredData(base: string, description: string) {
  const offers = PURCHASABLE_PLAN_IDS.map((id) => {
    const plan = PLANS[id];
    return {
      "@type": "Offer",
      name: plan.name,
      price: (plan.priceMonthlyCents! / 100).toFixed(2),
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (plan.priceMonthlyCents! / 100).toFixed(2),
        priceCurrency: "EUR",
        billingDuration: "P1M",
      },
      url: `${base}/preise`,
    };
  });
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: base,
      logo: `${base}/logo.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description,
      url: base,
      offers: [
        {
          "@type": "Offer",
          name: PLANS.free.name,
          price: "0.00",
          priceCurrency: "EUR",
          url: `${base}/preise`,
        },
        ...offers,
      ],
    },
  ];
}

/** JSON für ein `<script type="application/ld+json">` (kein `</script>`-Ausbruch). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
