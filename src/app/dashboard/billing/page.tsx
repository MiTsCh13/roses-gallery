import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { formatBytes, formatEuro } from "@/lib/format";
import {
  effectivePlan,
  PURCHASABLE_PLAN_IDS,
  PLANS,
  type SubscriptionStatus,
} from "@/lib/plans";
import { requireAccount } from "@/lib/session";
import { openPortal, startCheckout } from "./actions";

async function BillingContent() {
  await connection();
  const [t, { account }] = await Promise.all([
    getTranslations("Billing"),
    requireAccount(),
  ]);
  const status = account.subscriptionStatus as SubscriptionStatus;
  const current = effectivePlan({
    plan: account.plan,
    subscriptionStatus: status,
  });
  const subscribed =
    status === "trialing" || status === "active" || status === "past_due";
  const usedPct = Math.min(
    100,
    Math.round((account.storageUsedBytes / current.storageBytes) * 100),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <section className="space-y-3" aria-labelledby="current-plan">
        <h2 id="current-plan" className="text-lg font-medium">
          {t("currentPlan")}
        </h2>
        <p data-testid="current-plan">
          {current.name} · {t(`status.${status}`)}
        </p>
        {status === "trialing" && account.trialEndsAt && (
          <p className="text-sm text-muted-foreground">
            {t("trialEnds", {
              date: account.trialEndsAt.toLocaleDateString("de-DE"),
            })}
          </p>
        )}
        <div>
          <p className="text-sm" data-testid="storage-usage">
            {t("storage", {
              used: formatBytes(account.storageUsedBytes),
              total: formatBytes(current.storageBytes),
            })}
          </p>
          <div
            role="progressbar"
            aria-label={t("storageLabel")}
            aria-valuenow={usedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
        {subscribed && (
          <form action={openPortal}>
            <Button type="submit" variant="outline">
              {t("manage")}
            </Button>
          </form>
        )}
      </section>

      {!subscribed && (
        <section className="space-y-3" aria-labelledby="choose-plan">
          <h2 id="choose-plan" className="text-lg font-medium">
            {t("choosePlan")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("trialHint")}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PURCHASABLE_PLAN_IDS.map((id) => {
              const plan = PLANS[id];
              return (
                <li
                  key={id}
                  className="space-y-2 rounded-lg border p-4"
                  data-testid={`plan-${id}`}
                >
                  <h3 className="font-medium">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("planStorage", { size: formatBytes(plan.storageBytes) })}
                  </p>
                  <form action={startCheckout} className="flex flex-wrap gap-2">
                    <input type="hidden" name="plan" value={id} />
                    <Button
                      type="submit"
                      name="interval"
                      value="month"
                      size="sm"
                    >
                      {t("perMonth", {
                        price: formatEuro(plan.priceMonthlyCents!),
                      })}
                    </Button>
                    <Button
                      type="submit"
                      name="interval"
                      value="year"
                      size="sm"
                      variant="outline"
                    >
                      {t("perYear", {
                        price: formatEuro(plan.priceYearlyCents!),
                      })}
                    </Button>
                  </form>
                </li>
              );
            })}
            <li
              className="space-y-2 rounded-lg border border-dashed p-4"
              data-testid="plan-enterprise"
            >
              <h3 className="font-medium">{PLANS.enterprise.name}</h3>
              <p className="text-sm text-muted-foreground">
                {t("enterpriseHint")}
              </p>
              <p className="text-sm font-medium">{t("onRequest")}</p>
            </li>
          </ul>
        </section>
      )}
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}
