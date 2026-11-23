import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";

import { PricingTable } from "@/components/marketing/pricing-table";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { LEGAL_MISSING, legalDetails } from "@/lib/legal-details";
import { BETA_PLAN, isBetaMode } from "@/lib/plans";
import { pricingPlans, yearlyDiscountPercent } from "@/lib/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pricing");
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: "/preise" },
  };
}

async function EnterpriseContact() {
  await connection();
  const t = await getTranslations("Pricing");
  const email = legalDetails().LEGAL_EMAIL;
  if (email === LEGAL_MISSING) return null;
  const href = `mailto:${email}?subject=${encodeURIComponent(t("contactSubject"))}`;
  return (
    <Button asChild variant="outline" className="w-full rounded-full">
      <a href={href}>{t("contact")}</a>
    </Button>
  );
}

export default async function PricingPage() {
  const [t, tBeta] = await Promise.all([
    getTranslations("Pricing"),
    getTranslations("Beta"),
  ]);
  const core = t.raw("core") as string[];
  const beta = isBetaMode();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{t("intro")}</p>
      </header>
      {beta && (
        <p
          data-testid="beta-banner"
          className="mx-auto mt-8 max-w-2xl rounded-2xl border bg-accent/50 p-4 text-center text-sm text-accent-foreground"
        >
          {tBeta("pricingBanner", {
            storage: formatBytes(BETA_PLAN.storageBytes),
          })}
        </p>
      )}
      <div className="mt-10">
        <PricingTable
          beta={beta}
          plans={pricingPlans()}
          discountPercent={yearlyDiscountPercent()}
          enterpriseAction={
            <Suspense fallback={null}>
              <EnterpriseContact />
            </Suspense>
          }
        />
      </div>
      <section
        aria-labelledby="core-title"
        className="mx-auto mt-16 max-w-3xl rounded-2xl border bg-card p-6"
      >
        <h2 id="core-title" className="font-display text-xl font-semibold">
          {t("coreTitle")}
        </h2>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {core.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </section>
      <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
        {t("plannedHint")} {t("currencyHint")}
      </p>
    </main>
  );
}
