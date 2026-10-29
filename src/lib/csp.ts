// Statische Content-Security-Policy (D-129). Eine Nonce-Variante würde jede
// Seite dynamisch rendern und passt nicht zu `cacheComponents`; `script-src`
// braucht deshalb `'unsafe-inline'` für die Inline-Skripte von Next.js, alle
// übrigen Direktiven sind strikt.
export function buildCsp(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Medien kommen als signierte URLs von R2 bzw. dem Bunny-CDN.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "media-src": ["'self'", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    // Direkt-Uploads (R2, tus bei Bunny) und HLS-Segmente
    "connect-src": ["'self'", "https:", ...(isDev ? ["ws:", "wss:"] : [])],
    "frame-src": ["https://iframe.mediadelivery.net"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}
