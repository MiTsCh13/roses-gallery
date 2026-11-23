"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PricingPlan } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "yearly";

export function PricingTable({
  plans,
  discountPercent,
  enterpriseAction,
  beta = false,
}: {
  plans: PricingPlan[];
  discountPercent: number;
  /** Server-Slot (Mail-Link aus der Umgebung). */
  enterpriseAction?: React.ReactNode;
  /** Beta-Phase (D-159): Bezahlpläne sind noch nicht buchbar. */
  beta?: boolean;
}) {
  const t = useTranslations("Pricing");
  const tBeta = useTranslations("Beta");
  const [billing, setBilling] = useState<Billing>("monthly");
  return (
    <div className="flex flex-col items-center">
      <div
        role="group"
        aria-label={t("billingLabel")}
        className="inline-flex rounded-full border bg-card p-1 text-sm"
      >
        {(["monthly", "yearly"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={billing === value}
            onClick={() => setBilling(value)}
            className={cn(
              "rounded-full px-4 py-1.5 transition-colors",
              billing === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(value)}
            {value === "yearly" ? (
              <span className="ml-1 font-semibold">
                {t("yearlySave", { percent: discountPercent })}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <ul className="mt-10 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {plans.map((plan) => (
          <li
            key={plan.id}
            data-testid={`plan-${plan.id}`}
            className="flex flex-col rounded-2xl border bg-card p-6 shadow-xs"
          >
            <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
            <Price plan={plan} billing={billing} />
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              <li>{t("storage", { size: plan.storage })}</li>
              <li>
                {plan.maxGalleries === null
                  ? t("galleriesUnlimited")
                  : t("galleriesLimited", { count: plan.maxGalleries })}
              </li>
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-1.5">
                  <Clock
                    aria-hidden
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span>
                    {t(`features.${feature}`)}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({t("planned")})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              {plan.kind === "enterprise" ? (
                (enterpriseAction ?? null)
              ) : beta && plan.kind !== "free" ? (
                <p className="text-center text-sm text-muted-foreground">
                  {tBeta("afterBeta")}
                </p>
              ) : (
                <Button
                  asChild
                  className="w-full rounded-full"
                  variant={plan.kind === "free" ? "outline" : "default"}
                >
                  <Link href="/login">
                    {plan.kind === "free"
                      ? beta
                        ? tBeta("startFree")
                        : t("startFree")
                      : t("choose", { plan: plan.name })}
                  </Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Price({ plan, billing }: { plan: PricingPlan; billing: Billing }) {
  const t = useTranslations("Pricing");
  if (plan.kind === "enterprise") {
    return (
      <div className="mt-3">
        <p className="text-2xl font-semibold">{t("onRequest")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("enterpriseHint")}
        </p>
      </div>
    );
  }
  if (plan.kind === "free") {
    return (
      <div className="mt-3">
        <p className="text-2xl font-semibold">{t("freePrice")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("freeHint")}</p>
      </div>
    );
  }
  const yearly = billing === "yearly";
  return (
    <div className="mt-3">
      <p className="text-2xl font-semibold" data-testid="price">
        {yearly ? plan.yearly : plan.monthly}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {yearly ? t("perYear") : t("perMonth")}
        </span>
      </p>
      <p className="text-xs text-muted-foreground" data-testid="vat">
        {t("vatIncluded")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {yearly
          ? t("yearlyHint", { price: plan.yearlyPerMonth ?? "" })
          : t("trial", { days: plan.trialDays ?? 0 })}
      </p>
    </div>
  );
}
