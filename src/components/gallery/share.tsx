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

/** Story image (1080×1920) of one photo: share sheet with the file, else download. */
export function StoryShareButton({
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
  const [failed, setFailed] = useState(false);
  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(href);
      }
    } catch (e) {
      // a dismissed share sheet is not an error
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setFailed(true);
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
        {t("shareStory")}
      </button>
      {failed && (
        <span role="alert" className="ml-2">
          {t("shareStoryFailed")}
        </span>
      )}
    </span>
  );
}
