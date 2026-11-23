import { BRAND_BLADES } from "@/components/brand-mark";

export const BRAND_ROSE = "#A8314B";
export const BRAND_CREAM = "#FDF9F4";

/** Rosé-Kachel mit cremefarbener Bildmarke (App-Icon/Favicon, D-161). */
export function brandTileSvg(radius = 22): string {
  const blades = BRAND_BLADES.map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><rect x="-50" y="-50" width="100" height="100" rx="${radius}" fill="${BRAND_ROSE}"/><g transform="scale(0.72)" fill="${BRAND_CREAM}" stroke="${BRAND_ROSE}" stroke-width="5" stroke-linejoin="round">${blades}</g></svg>`;
}
