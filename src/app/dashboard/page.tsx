import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

async function DashboardContent() {
  await connection();
  const [t, session] = await Promise.all([
    getTranslations("Dashboard"),
    auth(),
  ]);
  if (!session) redirect("/login");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p data-testid="signed-in-as">
        {t("signedInAs", { email: session.user.email ?? "" })}
      </p>
      <Link href="/dashboard/galleries" className="underline">
        {t("galleries")}
      </Link>
      <Link href="/dashboard/billing" className="underline">
        {t("billing")}
      </Link>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          {t("signOut")}
        </Button>
      </form>
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
