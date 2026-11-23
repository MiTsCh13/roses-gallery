// Bildmarke „Blende mit Blütenlamellen“ (D-161): sechs geschwungene
// Blendenlamellen, die zugleich Blütenblätter sind. Die Fugen zwischen den
// Lamellen sind ein Strich in der Hintergrundfarbe (`gap`).
export const BRAND_BLADES = [
  "M0 -14L12.1 -7Q25.8 6.7 44.5 11.7A46 46 0 0 0 32.4 -32.7Q18.7 -19 0 -14Z",
  "M12.1 -7L12.1 7Q7.1 25.7 12.1 44.4A46 46 0 0 0 44.5 11.7Q25.8 6.7 12.1 -7Z",
  "M12.1 7L0 14Q-18.7 19 -32.4 32.7A46 46 0 0 0 12.1 44.4Q7.1 25.7 12.1 7Z",
  "M0 14L-12.1 7Q-25.8 -6.7 -44.5 -11.7A46 46 0 0 0 -32.4 32.7Q-18.7 19 0 14Z",
  "M-12.1 7L-12.1 -7Q-7.1 -25.7 -12.1 -44.4A46 46 0 0 0 -44.5 -11.7Q-25.8 -6.7 -12.1 7Z",
  "M-12.1 -7L0 -14Q18.7 -19 32.4 -32.7A46 46 0 0 0 -12.1 -44.4Q-7.1 -25.7 -12.1 -7Z",
] as const;

/** Dekorativ (aria-hidden); der Markenname steht daneben als Text. */
export function BrandMark({
  className,
  gap = "var(--card)",
  strokeWidth = 4,
}: {
  className?: string;
  gap?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="-50 -50 100 100"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-testid="brand-mark"
    >
      <g
        fill="currentColor"
        stroke={gap}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      >
        {BRAND_BLADES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
