const TOKEN_PARAMS = ["token", "expires", "token_path"] as const;

/**
 * Bunny's directory token (`token_path`) must accompany every request, but
 * playlists reference variants and segments by relative path without it.
 * Returns a function that adds the signed query of `src` to such URLs.
 */
export function tokenAppender(src: string): (url: string) => string {
  const base = new URL(src);
  const params = TOKEN_PARAMS.flatMap((name) => {
    const value = base.searchParams.get(name);
    return value === null ? [] : ([[name, value]] as const);
  });
  return (url) => {
    if (params.length === 0) return url;
    const target = new URL(url, base);
    if (target.origin !== base.origin || target.searchParams.has("token")) {
      return url;
    }
    for (const [name, value] of params) target.searchParams.set(name, value);
    return target.toString();
  };
}
