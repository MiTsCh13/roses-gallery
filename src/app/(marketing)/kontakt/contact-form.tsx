"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendContactAction, type ContactState } from "./actions";

export function ContactForm() {
  const t = useTranslations("Contact");
  const [state, action, pending] = useActionState<ContactState, FormData>(
    sendContactAction,
    {},
  );
  if (state.sent)
    return (
      <p
        role="status"
        data-testid="contact-sent"
        className="rounded-2xl border bg-accent/40 p-6"
      >
        {t("sent")}
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="contact-name" className="text-sm font-medium">
          {t("name")}
        </label>
        <Input
          id="contact-name"
          name="name"
          autoComplete="name"
          maxLength={100}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="contact-email" className="text-sm font-medium">
          {t("email")}
        </label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="contact-message" className="text-sm font-medium">
          {t("message")}
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          minLength={10}
          maxLength={5000}
          required
          className="rounded-md border bg-transparent px-3 py-2 text-base md:text-sm"
        />
      </div>
      {/* Honigtopf für Bots: für Menschen und Screenreader verborgen. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t.rich("privacy", {
          link: (chunks) => (
            <Link href="/datenschutz" className="underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
      {state.error && (
        <p role="alert" id="contact-error" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {t("send")}
      </Button>
    </form>
  );
}
