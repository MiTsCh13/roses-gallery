"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Copies the absolute public link of the gallery. */
export function CopyLinkButton({ path }: { path: string }) {
  const t = useTranslations("Galleries");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(
            new URL(path, window.location.origin).toString(),
          );
          setState("copied");
          setTimeout(() => setState("idle"), 2500);
        } catch {
          setState("failed");
        }
      }}
    >
      {state === "copied"
        ? t("linkCopied")
        : state === "failed"
          ? t("linkCopyFailed")
          : t("copyLink")}
    </Button>
  );
}
