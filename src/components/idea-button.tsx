"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";

import {
  submitIdeaAction,
  type IdeaState,
} from "@/app/dashboard/ideas/actions";
import { Button } from "@/components/ui/button";

/** „Idee einreichen“: schlankes Formular im nativen <dialog>. */
export function IdeaButton() {
  const t = useTranslations("Ideas");
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<IdeaState, FormData>(
    submitIdeaAction,
    {},
  );
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => dialog.current?.showModal()}
        data-testid="idea-open"
      >
        <Lightbulb aria-hidden className="size-4" />
        <span className="hidden sm:inline">{t("open")}</span>
        <span className="sr-only sm:hidden">{t("open")}</span>
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="idea-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="text-card-foreground m-auto w-full max-w-md rounded-xl border bg-card p-6 backdrop:bg-black/40"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="idea-title" className="text-lg font-semibold">
            {t("title")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => dialog.current?.close()}
          >
            {t("close")}
          </Button>
        </div>
        {state.sent ? (
          <p role="status" data-testid="idea-sent" className="text-sm">
            {t("sent")}
          </p>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <label
              htmlFor="idea-text"
              className="text-sm text-muted-foreground"
            >
              {t("intro")}
            </label>
            <textarea
              id="idea-text"
              name="idea"
              rows={5}
              minLength={10}
              maxLength={2000}
              required
              className="rounded-md border bg-transparent px-3 py-2 text-base md:text-sm"
            />
            {state.error && (
              <p
                role="alert"
                id="idea-error"
                className="text-sm text-destructive"
              >
                {t(`errors.${state.error}`)}
              </p>
            )}
            <Button type="submit" disabled={pending} className="self-end">
              {t("send")}
            </Button>
          </form>
        )}
      </dialog>
    </>
  );
}
