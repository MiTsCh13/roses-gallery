// Darstellungsmodell der Preisseite. Liest ausschließlich aus lib/plans.ts,
// damit Website und Checkout nie auseinanderlaufen.
import { formatBytes, formatEuro } from "@/lib/format";
import {
  FEATURES,
  PLAN_IDS,
  PLANS,
  TRIAL_DAYS,
  type Feature,
  type PlanId,
} from "@/lib/plans";

export type PricingPlan = {
  id: PlanId;
  name: string;
  kind: "free" | "paid" | "enterprise";
  storage: string;
  /** `null` = unbegrenzt. */
  maxGalleries: number | null;
  /** Formatierte Preise; `null` bei Free (0 €) und Enterprise (auf Anfrage). */
  monthly: string | null;
  yearly: string | null;
  /** Jahrespreis umgerechnet auf einen Monat. */
  yearlyPerMonth: string | null;
  trialDays: number | null;
  /** Plan-Funktionen in fester Reihenfolge (FEATURES). */
  features: Feature[];
};

export function pricingPlans(): PricingPlan[] {
  return PLAN_IDS.map((id) => {
    const plan = PLANS[id];
    const kind =
      id === "free" ? "free" : id === "enterprise" ? "enterprise" : "paid";
    const paid = kind === "paid";
    return {
      id,
      name: plan.name,
      kind,
      storage: formatBytes(plan.storageBytes),
      maxGalleries: plan.maxGalleries,
      monthly:
        paid && plan.priceMonthlyCents !== null
          ? formatEuro(plan.priceMonthlyCents)
          : null,
      yearly:
        paid && plan.priceYearlyCents !== null
          ? formatEuro(plan.priceYearlyCents)
          : null,
      yearlyPerMonth:
        paid && plan.priceYearlyCents !== null
          ? formatEuro(Math.round(plan.priceYearlyCents / 12))
          : null,
      trialDays: paid ? TRIAL_DAYS : null,
      features: FEATURES.filter((f) => plan.features.has(f)),
    };
  });
}

/** Ersparnis des Jahresabos in ganzen Prozent (über alle buchbaren Pläne gleich). */
export function yearlyDiscountPercent(): number {
  const paid = PLAN_IDS.map((id) => PLANS[id]).filter(
    (p) => p.priceMonthlyCents && p.priceYearlyCents,
  );
  const ratios = paid.map(
    (p) => 1 - p.priceYearlyCents! / (p.priceMonthlyCents! * 12),
  );
  return Math.round(Math.min(...ratios) * 100);
}
