export const DEFAULT_SITE_URL = "https://roses-gallery.app";

/** Öffentliche Basis-URL ohne abschließenden Slash (aus `AUTH_URL`). */
export function siteUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  const raw = source.AUTH_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // ungültige Angabe → Fallback
    }
  }
  return DEFAULT_SITE_URL;
}
