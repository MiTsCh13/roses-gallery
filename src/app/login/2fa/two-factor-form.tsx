"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifySecondFactor, type TwoFactorLoginState } from "./actions";

export function TwoFactorForm() {
  const t = useTranslations("TwoFactorLogin");
  const [state, action, pending] = useActionState<
    TwoFactorLoginState,
    FormData
  >(verifySecondFactor, {});
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label htmlFor="code" className="text-sm font-medium">
        {t("codeLabel")}
      </label>
      <Input
        id="code"
        name="code"
        inputMode="text"
        autoComplete="one-time-code"
        autoFocus
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "code-error" : undefined}
        required
      />
      {state.error && (
        <p id="code-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
