import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function PasswordResetDonePage() {
  const t = useTranslations("PasswordReset");
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-accent/60 via-background to-background px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">
          {t("doneTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("doneBody")}</p>
        <Button asChild>
          <Link href="/login">{t("toLogin")}</Link>
        </Button>
      </div>
    </main>
  );
}
