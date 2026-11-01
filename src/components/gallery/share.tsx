"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Shares the gallery link (Web Share API, else copies it). */
export function ShareLinkButton({ path }: { path: string }) {
  const t = useTranslations("PublicGallery");
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // dismissed share sheet or blocked clipboard: nothing to do
    }
  };
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" onClick={share}>
        {t("shareLink")}
      </Button>
      {copied && (
        <span role="status" className="text-sm">
          {t("shareCopied")}
        </span>
      )}
    </div>
  );
}

/**
 * Shares one photo (web size) through the device's share sheet, so it can go
 * straight to Instagram, WhatsApp & co. Where files cannot be shared (most
 * desktop browsers), the gallery link is shared or copied instead.
 */
export function PhotoShareButton({
  url,
  fileName,
  className = "",
}: {
  url: string;
  fileName: string;
  className?: string;
}) {
  const t = useTranslations("PublicGallery");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const run = async () => {
    setBusy(true);
    setState("idle");
    try {
      if (typeof navigator.canShare === "function") {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const file = new File([blob], fileName, {
          type: blob.type || "image/webp",
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      }
      const link = window.location.href;
      if (navigator.share) {
        await navigator.share({ url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setState("copied");
      }
    } catch (e) {
      // a dismissed share sheet is not an error
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setState("failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className={className}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="underline disabled:opacity-60"
      >
        {t("sharePhoto")}
      </button>
      {state === "copied" && (
        <span role="status" className="ml-2">
          {t("shareCopied")}
        </span>
      )}
      {state === "failed" && (
        <span role="alert" className="ml-2">
          {t("sharePhotoFailed")}
        </span>
      )}
    </span>
  );
}
