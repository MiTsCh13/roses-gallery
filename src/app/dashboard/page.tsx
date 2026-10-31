import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";

const CARDS = [
  { href: "/dashboard/galleries", key: "galleries" },
  { href: "/dashboard/billing", key: "billing" },
  { href: "/dashboard/security", key: "security" },
] as const;

async function DashboardContent() {
  await connection();
  const [t, session] = await Promise.all([
    getTranslations("Dashboard"),
    auth(),
  ]);
  if (session?.user?.secondFactorPending) redirect("/login/2fa");
  if (!session?.user?.accountId) redirect("/login");
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
      <ul className="grid gap-4 sm:grid-cols-3">
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
