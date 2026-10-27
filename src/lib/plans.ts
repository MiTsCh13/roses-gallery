// Single source of truth for plan limits and feature flags (F-ACC-03).
// Never compare plan names elsewhere – use the helpers below.
// Names, prices and feature split: see D-001 / D-109 in docs/DECISIONS.md.

const GB = 1024 ** 3;

export const PLAN_IDS = [
  "free",
  "bud",
  "bloom",
  "bouquet",
  "enterprise",
] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** Plans bookable through Checkout; Enterprise is agreed individually. */
export const PURCHASABLE_PLAN_IDS = ["bud", "bloom", "bouquet"] as const;

export type PurchasablePlanId = (typeof PURCHASABLE_PLAN_IDS)[number];

export function isPurchasablePlan(value: string): value is PurchasablePlanId {
  return (PURCHASABLE_PLAN_IDS as readonly string[]).includes(value);
}

export const FEATURES = [
  "video_cover",
  "branding_socials",
  "tips",
  "premiere",
  "face_search",
  "white_label",
  "external_download_links",
  "video_chapters",
] as const;

export type Feature = (typeof FEATURES)[number];

export type Plan = {
  id: PlanId;
  name: string;
  storageBytes: number;
  /** Prices in EUR cent; `null` = not bookable (Free, Enterprise on request). */
  priceMonthlyCents: number | null;
  priceYearlyCents: number | null;
  /** `null` = unlimited. */
  maxGalleries: number | null;
  features: ReadonlySet<Feature>;
};

const BLOOM: Feature[] = [
  "video_cover",
  "branding_socials",
  "tips",
  "premiere",
];
const ALL: Feature[] = [...FEATURES];

// Yearly price ≈ 20 % below 12 × monthly, rounded to whole euros.
const yearly = (monthlyCents: number) =>
  Math.round((monthlyCents * 12 * 0.8) / 100) * 100;

function plan(
  id: PlanId,
  name: string,
  storageGb: number,
  monthlyCents: number | null,
  features: Feature[],
  maxGalleries: number | null = null,
): Plan {
  return {
    id,
    name,
    storageBytes: storageGb * GB,
    priceMonthlyCents: monthlyCents,
    priceYearlyCents: monthlyCents === null ? null : yearly(monthlyCents),
    maxGalleries,
    features: new Set(features),
  };
}

export const PLANS: Record<PlanId, Plan> = {
  free: plan("free", "Free", 2, null, [], 3),
  bud: plan("bud", "Bud", 50, 1000, []),
  bloom: plan("bloom", "Bloom", 250, 2000, BLOOM),
  bouquet: plan("bouquet", "Bouquet", 1024, 5000, ALL),
  // Default quota; the real contract value is set per account on request.
  enterprise: plan("enterprise", "Enterprise", 5 * 1024, null, ALL),
};

export const TRIAL_DAYS = 14;

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export type SubscriptionStatus =
  "none" | "trialing" | "active" | "past_due" | "canceled";

export type BillingState = {
  plan: string;
  subscriptionStatus: SubscriptionStatus;
};

// Paid limits apply while the subscription is trialing or active. Any other
// state (never subscribed, canceled, unpaid) falls back to the free plan.
export function effectivePlan(account: BillingState): Plan {
  const paid =
    account.subscriptionStatus === "trialing" ||
    account.subscriptionStatus === "active" ||
    // Grace period: Stripe retries failed payments while `past_due`.
    account.subscriptionStatus === "past_due";
  return paid && isPlanId(account.plan) ? PLANS[account.plan] : PLANS.free;
}

export function hasFeature(account: BillingState, feature: Feature): boolean {
  return effectivePlan(account).features.has(feature);
}

export class PlanLimitError extends Error {
  constructor(
    readonly code: "storage_exceeded" | "gallery_limit" | "feature_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export function assertFeature(account: BillingState, feature: Feature) {
  if (!hasFeature(account, feature)) {
    throw new PlanLimitError(
      "feature_unavailable",
      `Feature "${feature}" is not part of the current plan.`,
    );
  }
}

/** Blocks an upload that would push the account over its storage quota. */
export function assertCanUpload(
  account: BillingState & { storageUsedBytes: number },
  incomingBytes: number,
) {
  if (!Number.isFinite(incomingBytes) || incomingBytes < 0) {
    throw new RangeError("incomingBytes must be a non-negative number");
  }
  const { storageBytes } = effectivePlan(account);
  if (account.storageUsedBytes + incomingBytes > storageBytes) {
    throw new PlanLimitError(
      "storage_exceeded",
      "The storage quota of the current plan would be exceeded.",
    );
  }
}

export function assertCanCreateGallery(
  account: BillingState,
  currentGalleryCount: number,
) {
  const { maxGalleries } = effectivePlan(account);
  if (maxGalleries !== null && currentGalleryCount >= maxGalleries) {
    throw new PlanLimitError(
      "gallery_limit",
      "The gallery limit of the current plan is reached.",
    );
  }
}
