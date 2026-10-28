"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Signed player URL is only requested on click and expires on its own. */
export function VideoPreview({ mediaId }: { mediaId: string }) {
  const t = useTranslations("VideoUpload");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function signed(action: "playback" | "original") {
    setFailed(false);
    const response = await fetch(`/api/videos/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaId }),
    });
    if (!response.ok) {
      setFailed(true);
      return null;
    }
    return (await response.json()).url as string;
  }

  async function open() {
    const next = await signed("playback");
    if (next) setUrl(next);
  }

  async function download() {
    const next = await signed("original");
    if (next) window.location.assign(next);
  }

  if (url) {
    return (
      <>
        <iframe
          src={url}
          title={t("player")}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full rounded-md border"
          data-testid="video-player"
        />
        <Button type="button" variant="outline" size="sm" onClick={download}>
          {t("download")}
        </Button>
      </>
    );
  }
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={open}>
        {t("play")}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={download}>
        {t("download")}
      </Button>
      {failed && <span className="text-destructive">{t("error.failed")}</span>}
    </>
  );
}
