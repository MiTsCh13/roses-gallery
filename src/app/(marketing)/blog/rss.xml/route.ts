import { getTranslations } from "next-intl/server";

import { buildRss, listPosts } from "@/lib/blog";
import { siteUrl } from "@/lib/site-url";

export async function GET() {
  const t = await getTranslations("Blog");
  const xml = buildRss(listPosts(), {
    url: siteUrl(),
    title: `Roses Gallery – ${t("title")}`,
    description: t("description"),
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
