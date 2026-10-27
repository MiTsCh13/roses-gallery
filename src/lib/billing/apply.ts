import { and, eq, isNull, lt, or } from "drizzle-orm";

import type { Db } from "@/db";
import { accounts } from "@/db/schema";
import type { SubscriptionEvent } from "./types";

/**
 * Writes a subscription change onto its account. Idempotent and tolerant of
 * out-of-order delivery: an event older than the last applied one is ignored.
 * Returns whether the account was updated.
 */
export async function applySubscriptionEvent(
  db: Db,
  event: SubscriptionEvent,
): Promise<boolean> {
  const target = event.accountId
    ? eq(accounts.id, event.accountId)
    : eq(accounts.stripeCustomerId, event.customerId);
  const rows = await db
    .update(accounts)
    .set({
      plan: event.plan,
      subscriptionStatus: event.status,
      billingInterval: event.interval,
      stripeCustomerId: event.customerId,
      stripeSubscriptionId: event.subscriptionId,
      trialEndsAt: event.trialEndsAt,
      currentPeriodEnd: event.currentPeriodEnd,
      billingEventAt: event.occurredAt,
    })
    .where(
      and(
        target,
        or(
          isNull(accounts.billingEventAt),
          lt(accounts.billingEventAt, event.occurredAt),
        ),
      ),
    )
    .returning({ id: accounts.id });
  return rows.length > 0;
}
