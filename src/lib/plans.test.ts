import { describe, expect, it } from "vitest";

import {
  assertCanCreateGallery,
  assertCanUpload,
  assertFeature,
  effectivePlan,
  hasFeature,
  PLAN_IDS,
  PLANS,
  PlanLimitError,
  type BillingState,
} from "./plans";

const GB = 1024 ** 3;
const active = (plan: string): BillingState => ({
  plan,
  subscriptionStatus: "active",
});

describe("plan catalogue", () => {
  it("has integer cent prices and ~20 % cheaper yearly billing", () => {
    for (const id of PLAN_IDS) {
      const p = PLANS[id];
      if (p.priceMonthlyCents === null) continue;
      expect(Number.isInteger(p.priceMonthlyCents)).toBe(true);
      expect(Number.isInteger(p.priceYearlyCents)).toBe(true);
      const ratio = p.priceYearlyCents! / (p.priceMonthlyCents * 12);
      expect(ratio).toBeGreaterThan(0.77);
      expect(ratio).toBeLessThan(0.83);
    }
  });

  it("grows storage with every paid tier", () => {
    const sizes = PLAN_IDS.map((id) => PLANS[id].storageBytes);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });
});

describe("effectivePlan", () => {
  it("uses the booked plan while trialing, active or past due", () => {
    for (const subscriptionStatus of [
      "trialing",
      "active",
      "past_due",
    ] as const) {
      expect(effectivePlan({ plan: "bloom", subscriptionStatus }).id).toBe(
        "bloom",
      );
    }
  });

  it("falls back to free without a running subscription or with an unknown plan", () => {
    expect(
      effectivePlan({ plan: "bouquet", subscriptionStatus: "canceled" }).id,
    ).toBe("free");
    expect(
      effectivePlan({ plan: "bouquet", subscriptionStatus: "none" }).id,
    ).toBe("free");
    expect(effectivePlan(active("bogus")).id).toBe("free");
  });
});

describe("feature flags", () => {
  it("gates features by plan", () => {
    expect(hasFeature(active("bud"), "tips")).toBe(false);
    expect(hasFeature(active("bloom"), "tips")).toBe(true);
    expect(hasFeature(active("bloom"), "white_label")).toBe(false);
    expect(hasFeature(active("bouquet"), "white_label")).toBe(true);
    expect(hasFeature(active("bouquet"), "video_chapters")).toBe(true);
  });

  it("assertFeature throws a PlanLimitError", () => {
    expect(() => assertFeature(active("bud"), "premiere")).toThrow(
      PlanLimitError,
    );
    expect(() => assertFeature(active("bloom"), "premiere")).not.toThrow();
  });
});

describe("assertCanUpload", () => {
  const account = (used: number) => ({
    ...active("bud"),
    storageUsedBytes: used,
  });

  it("allows uploads up to exactly the quota", () => {
    expect(() => assertCanUpload(account(49 * GB), 1 * GB)).not.toThrow();
  });

  it("blocks uploads above the quota", () => {
    expect(() => assertCanUpload(account(49 * GB), 1 * GB + 1)).toThrowError(
      expect.objectContaining({ code: "storage_exceeded" }),
    );
  });

  it("applies the free quota after cancellation", () => {
    const canceled = {
      plan: "bud",
      subscriptionStatus: "canceled" as const,
      storageUsedBytes: 3 * GB,
    };
    expect(() => assertCanUpload(canceled, 1)).toThrow(PlanLimitError);
  });

  it("rejects invalid sizes", () => {
    expect(() => assertCanUpload(account(0), -1)).toThrow(RangeError);
    expect(() => assertCanUpload(account(0), Number.NaN)).toThrow(RangeError);
  });
});

describe("assertCanCreateGallery", () => {
  it("limits the free plan to 3 galleries and leaves paid plans unlimited", () => {
    const free = { plan: "free", subscriptionStatus: "none" as const };
    expect(() => assertCanCreateGallery(free, 2)).not.toThrow();
    expect(() => assertCanCreateGallery(free, 3)).toThrowError(
      expect.objectContaining({ code: "gallery_limit" }),
    );
    expect(() => assertCanCreateGallery(active("bud"), 10_000)).not.toThrow();
  });
});

describe("D-001 price list", () => {
  it("sells Bud, Bloom and Bouquet at 10, 20 and 50 EUR and keeps Enterprise on request", () => {
    expect(PLANS.bud.priceMonthlyCents).toBe(1000);
    expect(PLANS.bloom.priceMonthlyCents).toBe(2000);
    expect(PLANS.bouquet.priceMonthlyCents).toBe(5000);
    expect(PLANS.enterprise.priceMonthlyCents).toBeNull();
    expect(PLANS.enterprise.priceYearlyCents).toBeNull();
  });

  it("gives Enterprise every feature", () => {
    expect(hasFeature(active("enterprise"), "face_search")).toBe(true);
    expect(hasFeature(active("enterprise"), "white_label")).toBe(true);
  });
});
