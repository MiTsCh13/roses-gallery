import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { applySubscriptionEvent } from "./apply";
import type { SubscriptionEvent } from "./types";

const { db, close } = createTestDb();
let accountId: string;

const event = (over: Partial<SubscriptionEvent> = {}): SubscriptionEvent => ({
  id: "evt_1",
  occurredAt: new Date("2026-10-27T10:00:00Z"),
  accountId,
  customerId: "cus_1",
  subscriptionId: "sub_1",
  plan: "bloom",
  interval: "month",
  status: "trialing",
  trialEndsAt: new Date("2026-11-10T10:00:00Z"),
  currentPeriodEnd: new Date("2026-11-10T10:00:00Z"),
  ...over,
});

const load = async () =>
  (await db.select().from(accounts).where(eq(accounts.id, accountId)))[0];

beforeEach(async () => {
  await resetDb(db);
  [{ id: accountId }] = await db
    .insert(accounts)
    .values({ name: "A" })
    .returning();
});
afterAll(() => close());

describe("applySubscriptionEvent", () => {
  it("writes plan, status and Stripe ids onto the account", async () => {
    expect(await applySubscriptionEvent(db as never, event())).toBe(true);
    expect(await load()).toMatchObject({
      plan: "bloom",
      subscriptionStatus: "trialing",
      billingInterval: "month",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
  });

  it("finds the account by customer id when metadata has no accountId", async () => {
    await applySubscriptionEvent(db as never, event());
    const later = event({
      accountId: null,
      occurredAt: new Date("2026-10-28T10:00:00Z"),
      status: "active",
    });
    expect(await applySubscriptionEvent(db as never, later)).toBe(true);
    expect((await load()).subscriptionStatus).toBe("active");
  });

  it("ignores stale and replayed events", async () => {
    await applySubscriptionEvent(
      db as never,
      event({ status: "active", occurredAt: new Date("2026-10-28T00:00:00Z") }),
    );
    const stale = event({
      status: "canceled",
      occurredAt: new Date("2026-10-27T00:00:00Z"),
    });
    expect(await applySubscriptionEvent(db as never, stale)).toBe(false);
    expect((await load()).subscriptionStatus).toBe("active");
  });

  it("does not touch other accounts", async () => {
    const [other] = await db.insert(accounts).values({ name: "B" }).returning();
    await applySubscriptionEvent(db as never, event());
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, other.id));
    expect(row.plan).toBe("free");
  });
});
