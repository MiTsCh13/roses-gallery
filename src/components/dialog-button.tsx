"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";

/** Button, der einen modalen Dialog (natives <dialog>) öffnet. */
export function DialogButton({
  label,
  title,
  closeLabel,
  children,
}: {
  label: string;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        aria-label={title}
        onClick={(e) => {
          // Klick auf den Hintergrund schließt den Dialog.
          if (e.target === ref.current) ref.current?.close();
        }}
        className="text-card-foreground m-auto w-full max-w-lg rounded-xl border bg-card p-6 backdrop:bg-black/40"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            onClick={() => ref.current?.close()}
          >
            {closeLabel}
          </Button>
        </div>
        <div className="space-y-3">{children}</div>
      </dialog>
    </>
  );
}
