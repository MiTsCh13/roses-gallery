import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { cancelSecondFactor } from "./actions";
import { TwoFactorForm } from "./two-factor-form";

async function TwoFactorContent() {
  await connection();
  const [t, session] = await Promise.all([
    getTranslations("TwoFactorLogin"),
    auth(),
  ]);
  if (!session?.user) redirect("/login");
  if (!session.user.secondFactorPending) redirect("/dashboard");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <TwoFactorForm />
      <form action={cancelSecondFactor}>
        <Button type="submit" variant="outline" className="w-full">
          {t("signOut")}
        </Button>
      </form>
    </main>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense>
      <TwoFactorContent />
    </Suspense>
  );
}
