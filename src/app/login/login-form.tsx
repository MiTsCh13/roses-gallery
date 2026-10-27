"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label htmlFor="email" className="text-sm font-medium">
        {t("emailLabel")}
      </label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "email-error" : undefined}
        required
      />
      {state.error && (
        <p id="email-error" role="alert" className="text-sm text-destructive">
          {t("errors.invalid_email")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
