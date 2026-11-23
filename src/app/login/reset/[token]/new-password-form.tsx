"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordAction, type ResetState } from "../actions";

export function NewPasswordForm({ token }: { token: string }) {
  const t = useTranslations("PasswordReset");
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPasswordAction.bind(null, token),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label htmlFor="new-password" className="text-sm font-medium">
        {t("newPassword")}
      </label>
      <Input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <label htmlFor="confirm-password" className="text-sm font-medium">
        {t("confirmPassword")}
      </label>
      <Input
        id="confirm-password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        minLength={8}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "reset-error" : undefined}
        required
      />
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      {state.error && (
        <p id="reset-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
