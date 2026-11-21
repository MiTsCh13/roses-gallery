"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmSetup, disableSetup, type SecurityState } from "./actions";

function CodeField({ error }: { error?: string }) {
  const t = useTranslations("Security");
  return (
    <>
      <label htmlFor="code" className="text-sm font-medium">
        {t("codeLabel")}
      </label>
      <Input
        id="code"
        name="code"
        autoComplete="one-time-code"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "code-error" : undefined}
        required
      />
      {error && (
        <p id="code-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${error as "invalid" | "rate_limited"}`)}
        </p>
      )}
    </>
  );
}

export function ConfirmSetupForm() {
  const t = useTranslations("Security");
  const [state, action, pending] = useActionState<SecurityState, FormData>(
    confirmSetup,
    {},
  );
  if (state.recoveryCodes) {
    return (
      <section aria-labelledby="recovery" className="space-y-2">
        <h2 id="recovery" className="text-lg font-medium">
          {t("recoveryTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("recoveryInfo")}</p>
        <ul data-testid="recovery-codes" className="font-mono text-sm">
          {state.recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <CodeField error={state.error} />
      <Button type="submit" disabled={pending}>
        {t("confirm")}
      </Button>
    </form>
  );
}

export function DisableForm() {
  const t = useTranslations("Security");
  const [state, action, pending] = useActionState<SecurityState, FormData>(
    disableSetup,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <p className="text-sm text-muted-foreground">{t("disableInfo")}</p>
      <CodeField error={state.error} />
      <Button type="submit" variant="outline" disabled={pending}>
        {t("disable")}
      </Button>
    </form>
  );
}
