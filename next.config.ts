import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import createNextIntlPlugin from "next-intl/plugin";

import { buildCsp } from "./src/lib/csp";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildCsp(process.env.NODE_ENV !== "production"),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // Kundengalerien und App nie indexieren – auch wenn robots.txt ignoriert wird.
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/g/:path*", headers: noindex },
      { source: "/dashboard/:path*", headers: noindex },
      { source: "/login/:path*", headers: noindex },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Blogbeiträge (content/blog/*.mdx); die YAML-Frontmatter wird aus dem
// Inhalt entfernt und separat in lib/blog.ts geprüft.
const withMDX = createMDX({
  options: { remarkPlugins: ["remark-frontmatter"] },
});

export default withNextIntl(withMDX(nextConfig));
