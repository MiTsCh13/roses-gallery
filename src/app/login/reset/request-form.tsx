"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction, type ResetRequestState } from "./actions";

export function ResetRequestForm() {
  const t = useTranslations("PasswordReset");
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordResetAction,
    {},
  );
  if (state.sent)
    return (
      <p role="status" className="text-sm" data-testid="reset-sent">
        {t("sent")}
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label htmlFor="reset-email" className="text-sm font-medium">
        {t("emailLabel")}
      </label>
      <Input
        id="reset-email"
        name="email"
        type="email"
        autoComplete="email"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "reset-email-error" : undefined}
        required
      />
      {state.error && (
        <p
          id="reset-email-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {t("errors.invalid_email")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t("send")}
      </Button>
    </form>
  );
}
