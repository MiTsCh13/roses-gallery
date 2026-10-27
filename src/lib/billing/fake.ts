import { z } from "zod";

import { PLAN_IDS } from "@/lib/plans";
import {
  InvalidWebhookError,
  type BillingProvider,
  type CheckoutInput,
  type SubscriptionEvent,
} from "./types";

export const FAKE_SIGNATURE = "fake-signature";

const payloadSchema = z.object({
  id: z.string(),
  occurredAt: z.iso.datetime(),
  accountId: z.string().nullable(),
  customerId: z.string(),
  subscriptionId: z.string(),
  plan: z.enum(PLAN_IDS),
  interval: z.enum(["month", "year"]),
  status: z.enum(["none", "trialing", "active", "past_due", "canceled"]),
  trialEndsAt: z.iso.datetime().nullable(),
  currentPeriodEnd: z.iso.datetime().nullable(),
});

/** Test double: checkout returns the success URL, webhooks carry plain JSON. */
export class FakeBilling implements BillingProvider {
  readonly checkouts: CheckoutInput[] = [];

  async createCheckoutSession(input: CheckoutInput) {
    this.checkouts.push(input);
    return { url: input.successUrl };
  }

  async createPortalSession(input: { customerId: string; returnUrl: string }) {
    return { url: input.returnUrl };
  }

  async parseWebhook(rawBody: string, signature: string | null) {
    if (signature !== FAKE_SIGNATURE) throw new InvalidWebhookError();
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new InvalidWebhookError();
    }
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) throw new InvalidWebhookError();
    const p = parsed.data;
    return {
      ...p,
      occurredAt: new Date(p.occurredAt),
      trialEndsAt: p.trialEndsAt ? new Date(p.trialEndsAt) : null,
      currentPeriodEnd: p.currentPeriodEnd
        ? new Date(p.currentPeriodEnd)
        : null,
    } satisfies SubscriptionEvent;
  }
}
