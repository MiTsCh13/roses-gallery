import { serverEnv } from "@/lib/env";
import { FakeBilling } from "./fake";
import { StripeBilling } from "./stripe";
import type { BillingProvider } from "./types";

const globalForBilling = globalThis as unknown as { billing?: BillingProvider };

export function getBilling(): BillingProvider {
  if (globalForBilling.billing) return globalForBilling.billing;
  const env = serverEnv();
  const transport =
    env.BILLING_TRANSPORT ?? (env.STRIPE_SECRET_KEY ? "stripe" : "fake");
  if (transport === "fake") {
    if (env.NODE_ENV === "production" && env.E2E_TEST_MODE !== "1") {
      throw new Error(
        "The fake billing provider must not be used in production.",
      );
    }
    globalForBilling.billing = new FakeBilling();
  } else {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error(
        "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required.",
      );
    }
    globalForBilling.billing = new StripeBilling(
      env.STRIPE_SECRET_KEY,
      env.STRIPE_WEBHOOK_SECRET,
    );
  }
  return globalForBilling.billing;
}
