import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { isResetTokenValid } from "@/lib/password-reset";
import { NewPasswordForm } from "./new-password-form";

async function Content({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const [{ token }, t] = await Promise.all([
    params,
    getTranslations("PasswordReset"),
  ]);
  const valid = await isResetTokenValid(db(), token);
  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border bg-card p-8 shadow-sm">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">
        {t("newTitle")}
      </h1>
      {valid ? (
        <NewPasswordForm token={token} />
      ) : (
        <>
          <p role="alert" className="text-sm text-destructive">
            {t("errors.invalid_token")}
          </p>
          <Link
            href="/login/reset"
            className="text-sm underline-offset-2 hover:underline"
          >
            {t("requestAgain")}
          </Link>
        </>
      )}
    </div>
  );
}

export default function NewPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-accent/60 via-background to-background px-6 py-16">
      <Suspense>
        <Content params={params} />
      </Suspense>
    </main>
  );
}
