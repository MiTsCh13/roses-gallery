"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Signed player URL is only requested on click and expires on its own. */
export function VideoPreview({ mediaId }: { mediaId: string }) {
  const t = useTranslations("VideoUpload");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function open() {
    setFailed(false);
    const response = await fetch("/api/videos/playback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaId }),
    });
    if (!response.ok) return setFailed(true);
    setUrl((await response.json()).url);
  }

  if (url) {
    return (
      <iframe
        src={url}
        title={t("player")}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-md border"
        data-testid="video-player"
      />
    );
  }
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={open}>
        {t("play")}
      </Button>
      {failed && <span className="text-destructive">{t("error.failed")}</span>}
    </>
  );
}
