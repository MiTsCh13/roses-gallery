import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { LEGAL_MISSING, legalDetails } from "@/lib/legal-details";
import { isBetaMode } from "@/lib/plans";

const CARDS = [
  { href: "/dashboard/galleries", key: "galleries" },
  { href: "/dashboard/settings", key: "settings" },
] as const;

async function DashboardContent() {
  await connection();
  const [t, tBeta, session] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Beta"),
    auth(),
  ]);
  if (session?.user?.secondFactorPending) redirect("/login/2fa");
  if (!session?.user?.accountId) redirect("/login");
  // Beta (D-159): Feedback per Mail an die Adresse aus dem Impressum.
  const feedbackTo = legalDetails().LEGAL_EMAIL;
  const feedbackHref =
    isBetaMode() && feedbackTo !== LEGAL_MISSING
      ? `mailto:${feedbackTo}?subject=${encodeURIComponent(tBeta("feedbackSubject"))}`
      : null;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t("welcome")}
        </h1>
        <p className="text-muted-foreground">{t("welcomeText")}</p>
        <p className="text-sm text-muted-foreground" data-testid="signed-in-as">
          {t("signedInAs", { email: session.user.email ?? "" })}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="block h-full rounded-2xl border bg-card p-6 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <h2 className="font-display text-lg font-semibold">
                {t(card.key)}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`${card.key}Text`)}
              </p>
            </Link>
          </li>
        ))}
        {feedbackHref && (
          <li>
            <a
              href={feedbackHref}
              data-testid="beta-feedback"
              className="block h-full rounded-2xl border border-dashed bg-accent/40 p-6 transition hover:border-primary/40"
            >
              <h2 className="font-display text-lg font-semibold">
                {tBeta("feedbackTitle")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {tBeta("feedbackText")}
              </p>
            </a>
          </li>
        )}
      </ul>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
