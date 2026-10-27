import Stripe from "stripe";

import {
  isPlanId,
  PLANS,
  TRIAL_DAYS,
  type SubscriptionStatus,
} from "@/lib/plans";
import {
  InvalidWebhookError,
  type BillingInterval,
  type BillingProvider,
  type CheckoutInput,
  type SubscriptionEvent,
} from "./types";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "canceled",
  incomplete_expired: "canceled",
  paused: "canceled",
  incomplete: "none",
};

const toDate = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000) : null;

export function subscriptionEventFrom(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
): SubscriptionEvent | null {
  const { plan, interval, accountId } = subscription.metadata ?? {};
  if (!plan || !isPlanId(plan) || plan === "free") return null;
  if (interval !== "month" && interval !== "year") return null;
  const status = STATUS_MAP[subscription.status];
  if (!status) return null;
  const item = subscription.items.data[0];
  return {
    id: event.id,
    occurredAt: new Date(event.created * 1000),
    accountId: accountId ?? null,
    customerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    subscriptionId: subscription.id,
    plan,
    interval,
    status,
    trialEndsAt: toDate(subscription.trial_end),
    currentPeriodEnd: toDate(item?.current_period_end),
  };
}

export class StripeBilling implements BillingProvider {
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(input: CheckoutInput) {
    const plan = PLANS[input.plan];
    const amount =
      input.interval === "year"
        ? plan.priceYearlyCents
        : plan.priceMonthlyCents;
    if (amount === null)
      throw new Error(`Plan ${input.plan} is not purchasable`);
    const metadata = {
      accountId: input.accountId,
      plan: input.plan,
      interval: input.interval,
    };
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      ...(input.customerId
        ? { customer: input.customerId }
        : { customer_email: input.email }),
      client_reference_id: input.accountId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amount,
            recurring: { interval: input.interval },
            product_data: { name: `Roses Gallery ${plan.name}` },
          },
        },
      ],
      subscription_data: { trial_period_days: TRIAL_DAYS, metadata },
      metadata,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return { url: session.url };
  }

  async createPortalSession(input: { customerId: string; returnUrl: string }) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  async parseWebhook(rawBody: string, signature: string | null) {
    if (!signature) throw new InvalidWebhookError();
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new InvalidWebhookError();
    }
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      return subscriptionEventFrom(event, event.data.object);
    }
    return null;
  }
}

export type { BillingInterval };
