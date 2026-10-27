import type { PlanId, SubscriptionStatus } from "@/lib/plans";

export type BillingInterval = "month" | "year";

/** Provider-neutral view of a subscription change (from a Stripe webhook). */
export type SubscriptionEvent = {
  /** Provider event id, for logging. */
  id: string;
  /** Provider event time; older events than the stored one are ignored. */
  occurredAt: Date;
  accountId: string | null;
  customerId: string;
  subscriptionId: string;
  plan: PlanId;
  interval: BillingInterval;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

export type CheckoutInput = {
  accountId: string;
  email: string;
  customerId: string | null;
  plan: Exclude<PlanId, "free">;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
};

export class InvalidWebhookError extends Error {
  constructor(message = "Invalid webhook signature or payload") {
    super(message);
    this.name = "InvalidWebhookError";
  }
}

export interface BillingProvider {
  createCheckoutSession(input: CheckoutInput): Promise<{ url: string }>;
  createPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  /**
   * Verifies the signature and returns the normalized event, or `null` for
   * events we do not care about. Throws `InvalidWebhookError` on bad input.
   */
  parseWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<SubscriptionEvent | null>;
}
