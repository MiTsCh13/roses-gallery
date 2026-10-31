"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  requestMagicLink,
  signInWithPassword,
  type LoginState,
  type PasswordLoginState,
} from "./actions";

export function LoginForm() {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    {},
  );
  const [pwState, pwAction, pwPending] = useActionState<
    PasswordLoginState,
    FormData
  >(signInWithPassword, {});
  return (
    <div className="flex flex-col gap-6">
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
      <details className="rounded-md border p-3" open={!!pwState.error}>
        <summary className="cursor-pointer text-sm font-medium">
          {t("passwordToggle")}
        </summary>
        <form action={pwAction} className="mt-3 flex flex-col gap-3" noValidate>
          <label htmlFor="pw-email" className="text-sm font-medium">
            {t("passwordEmailLabel")}
          </label>
          <Input
            id="pw-email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <label htmlFor="pw-password" className="text-sm font-medium">
            {t("passwordLabel")}
          </label>
          <Input
            id="pw-password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={pwState.error ? true : undefined}
            aria-describedby={pwState.error ? "pw-error" : undefined}
            required
          />
          {pwState.error && (
            <p id="pw-error" role="alert" className="text-sm text-destructive">
              {t(`errors.${pwState.error}`)}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={pwPending}>
            {t("passwordSubmit")}
          </Button>
        </form>
      </details>
    </div>
  );
}
