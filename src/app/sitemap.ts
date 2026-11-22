import type { MetadataRoute } from "next";

import { listPosts } from "@/lib/blog";
import { buildSitemap } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(siteUrl(), listPosts({ includeDrafts: false }));
}
