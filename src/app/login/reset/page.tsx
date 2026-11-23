import Link from "next/link";
import { useTranslations } from "next-intl";

import { ResetRequestForm } from "./request-form";

export default function PasswordResetPage() {
  const t = useTranslations("PasswordReset");
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-accent/60 via-background to-background px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <ResetRequestForm />
        <Link
          href="/login"
          className="text-sm underline-offset-2 hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </main>
  );
}
