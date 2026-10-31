import type { NextConfig } from "next";
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
  async redirects() {
    return [
      {
        source: "/dashboard/billing",
        destination: "/dashboard/settings/billing",
        permanent: true,
      },
      {
        source: "/dashboard/security",
        destination: "/dashboard/settings/security",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
