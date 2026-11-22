import type { MDXComponents } from "mdx/types";
import Link from "next/link";

// Typografie für Blogbeiträge (kein Typography-Plugin nötig).
const components: MDXComponents = {
  h2: (props) => (
    <h2
      className="mt-10 font-display text-2xl font-semibold tracking-tight"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mt-8 font-display text-xl font-semibold" {...props} />
  ),
  p: (props) => <p className="mt-4 leading-relaxed" {...props} />,
  ul: (props) => (
    <ul className="mt-4 list-disc space-y-1 pl-6 leading-relaxed" {...props} />
  ),
  ol: (props) => (
    <ol
      className="mt-4 list-decimal space-y-1 pl-6 leading-relaxed"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="mt-4 border-l-4 border-primary/40 pl-4 text-muted-foreground italic"
      {...props}
    />
  ),
  a: ({ href = "", ...props }) =>
    href.startsWith("/") ? (
      <Link href={href} className="text-primary underline" {...props} />
    ) : (
      <a
        href={href}
        className="text-primary underline"
        rel="noopener noreferrer"
        {...props}
      />
    ),
  strong: (props) => <strong className="font-semibold" {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
