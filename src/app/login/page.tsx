import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { serverEnv } from "@/lib/env";
import { signInWithGoogle } from "./actions";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const t = useTranslations("Login");
  const env = serverEnv();
  const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-accent/60 via-background to-background px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <LoginForm />
        {googleEnabled && (
          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full">
              {t("google")}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
