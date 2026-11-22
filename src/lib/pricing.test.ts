import { describe, expect, it } from "vitest";

import { formatBytes, formatEuro } from "@/lib/format";
import { PLAN_IDS, PLANS, TRIAL_DAYS } from "@/lib/plans";
import { pricingPlans, yearlyDiscountPercent } from "@/lib/pricing";

describe("pricingPlans", () => {
  it("mirrors every plan from plans.ts in order", () => {
    const rows = pricingPlans();
    expect(rows.map((r) => r.id)).toEqual([...PLAN_IDS]);
    for (const row of rows) {
      const plan = PLANS[row.id];
      expect(row.name).toBe(plan.name);
      expect(row.storage).toBe(formatBytes(plan.storageBytes));
      expect(row.maxGalleries).toBe(plan.maxGalleries);
      expect(new Set(row.features)).toEqual(new Set(plan.features));
    }
  });

  it("formats paid prices from cents and hides them for free/enterprise", () => {
    const byId = Object.fromEntries(pricingPlans().map((r) => [r.id, r]));
    for (const id of ["bud", "bloom", "bouquet"] as const) {
      expect(byId[id].kind).toBe("paid");
      expect(byId[id].monthly).toBe(formatEuro(PLANS[id].priceMonthlyCents!));
      expect(byId[id].yearly).toBe(formatEuro(PLANS[id].priceYearlyCents!));
      expect(byId[id].trialDays).toBe(TRIAL_DAYS);
    }
    expect(byId.bud.monthly).toBe("10\u00a0€");
    expect(byId.free).toMatchObject({ kind: "free", monthly: null });
    expect(byId.enterprise).toMatchObject({
      kind: "enterprise",
      monthly: null,
      yearly: null,
    });
  });

  it("derives the yearly discount from the prices", () => {
    expect(yearlyDiscountPercent()).toBe(20);
  });
});
