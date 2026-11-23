import { getTranslations } from "next-intl/server";

import { isBetaMode } from "@/lib/plans";

/** Kleines „Beta“-Abzeichen neben dem Logo, nur mit `BETA_MODE=1` (D-159). */
export async function BetaBadge({ beta = isBetaMode() }: { beta?: boolean }) {
  if (!beta) return null;
  const t = await getTranslations("Beta");
  return (
    <span
      data-testid="beta-badge"
      className="rounded-full bg-accent px-2 py-0.5 font-sans text-xs font-medium text-accent-foreground"
    >
      {t("badge")}
    </span>
  );
}
