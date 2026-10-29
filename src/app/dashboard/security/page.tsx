import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { serverEnv } from "@/lib/env";
import { requireAccount } from "@/lib/session";
import { recoveryCodesLeft, pendingSetupSecret } from "@/lib/two-factor";
import { otpauthUri } from "@/lib/totp";
import { startSetup } from "./actions";
import { ConfirmSetupForm, DisableForm } from "./code-forms";

async function SecurityContent() {
  await connection();
  const [t, { user }] = await Promise.all([
    getTranslations("Security"),
    requireAccount(),
  ]);
  const [row] = await db()
    .select({ enabledAt: users.totpEnabledAt })
    .from(users)
    .where(eq(users.id, user.id));
  const enabled = Boolean(row?.enabledAt);
  const secret = enabled
    ? null
    : await pendingSetupSecret(db(), serverEnv().AUTH_SECRET ?? "", user.id);
  const left = enabled ? await recoveryCodesLeft(db(), user.id) : 0;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/dashboard" className="text-sm underline">
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <section className="space-y-3" aria-labelledby="two-factor">
        <h2 id="two-factor" className="text-lg font-medium">
          {t("twoFactor")}
        </h2>
        {enabled ? (
          <>
            <p data-testid="two-factor-state">{t("enabledInfo")}</p>
            <p className="text-sm text-muted-foreground">
              {t("recoveryLeft", { count: left })}
            </p>
            <DisableForm />
          </>
        ) : secret ? (
          <>
            <p className="text-sm text-muted-foreground">{t("setupIntro")}</p>
            <p className="text-sm font-medium">{t("secretLabel")}</p>
            <code data-testid="totp-secret" className="font-mono break-all">
              {secret}
            </code>
            <a
              className="text-sm underline"
              href={otpauthUri(secret, user.email ?? "")}
            >
              {t("openApp")}
            </a>
            <ConfirmSetupForm />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("disabledInfo")}</p>
            <form action={startSetup}>
              <Button type="submit">{t("start")}</Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

export default function SecurityPage() {
  return (
    <Suspense>
      <SecurityContent />
    </Suspense>
  );
}
