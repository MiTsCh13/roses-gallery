import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { StripeBilling, subscriptionEventFrom } from "./stripe";
import { InvalidWebhookError } from "./types";

const SECRET = "whsec_test";
const billing = new StripeBilling("sk_test_x", SECRET);

function payload(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_1",
    object: "event",
    type: "customer.subscription.updated",
    created: 1_790_000_000,
    data: {
      object: {
        id: "sub_1",
        object: "subscription",
        customer: "cus_1",
        status: "trialing",
        trial_end: 1_791_000_000,
        metadata: { accountId: "acc-1", plan: "bouquet", interval: "year" },
        items: { data: [{ current_period_end: 1_791_000_000 }] },
        ...over,
      },
    },
  });
}

const sign = (body: string) =>
  new Stripe("sk_test_x").webhooks.generateTestHeaderString({
    payload: body,
    secret: SECRET,
  });

describe("StripeBilling.parseWebhook", () => {
  it("normalizes a signed subscription event", async () => {
    const body = payload();
    const event = await billing.parseWebhook(body, sign(body));
    expect(event).toMatchObject({
      accountId: "acc-1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      plan: "bouquet",
      interval: "year",
      status: "trialing",
    });
    expect(event?.currentPeriodEnd).toEqual(new Date(1_791_000_000 * 1000));
  });

  it("rejects a missing or wrong signature", async () => {
    const body = payload();
    await expect(billing.parseWebhook(body, null)).rejects.toThrow(
      InvalidWebhookError,
    );
    await expect(billing.parseWebhook(body + " ", sign(body))).rejects.toThrow(
      InvalidWebhookError,
    );
  });

  it("ignores subscriptions without our metadata and unrelated event types", async () => {
    const noMeta = payload({ metadata: {} });
    expect(await billing.parseWebhook(noMeta, sign(noMeta))).toBeNull();
    const other = JSON.stringify({
      id: "e",
      object: "event",
      type: "invoice.paid",
      created: 1,
      data: { object: {} },
    });
    expect(await billing.parseWebhook(other, sign(other))).toBeNull();
  });

  it("maps Stripe statuses to ours", () => {
    const map = (status: string) =>
      subscriptionEventFrom(
        { id: "e", created: 1 } as Stripe.Event,
        JSON.parse(payload({ status })).data.object,
      )?.status;
    expect(map("active")).toBe("active");
    expect(map("unpaid")).toBe("canceled");
    expect(map("incomplete")).toBe("none");
    expect(map("something_new")).toBeUndefined();
  });
});
