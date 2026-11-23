import type { Redirect } from "next/dist/lib/load-custom-routes";

/**
 * `www.<domain>` → `https://<domain>` (D-152), dauerhaft (308) und mit Pfad.
 * Greift nur, wenn der Reverse-Proxy (Coolify) die www-Domain überhaupt an
 * die App weiterreicht; die Weiterleitung in Coolify selbst ist vorzuziehen.
 */
export function wwwRedirects(): Redirect[] {
  return [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www\\.(?<domain>.+)" }],
      destination: "https://:domain/:path*",
      permanent: true,
    },
  ];
}
