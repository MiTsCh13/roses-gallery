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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
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
    </main>
  );
}
