"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type Action = "playback" | "original";

async function signedUrl(action: Action, mediaId: string): Promise<string> {
  const res = await fetch(`/api/videos/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mediaId }),
  });
  if (!res.ok) throw new Error(`video_${action}_failed`);
  const { url } = (await res.json()) as { url: string };
  return url;
}

/**
 * Vorschau und Original-Download eines fertigen Videos in der Bibliothek
 * (D-145). Die signierten URLs werden erst beim Klick geholt, damit sie
 * nicht schon beim Seitenaufbau ablaufen.
 */
export function LibraryVideoActions({ mediaId }: { mediaId: string }) {
  const t = useTranslations("Library");
  const dialog = useRef<HTMLDialogElement>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState(false);

  const run = async (action: Action) => {
    setBusy(action);
    setError(false);
    try {
      const url = await signedUrl(action, mediaId);
      if (action === "original") {
        window.location.assign(url);
      } else {
        setPlayerUrl(url);
        dialog.current?.showModal();
      }
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    dialog.current?.close();
    setPlayerUrl(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy !== null}
        onClick={() => void run("playback")}
      >
        {t("watch")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={() => void run("original")}
      >
        {t("original")}
      </Button>
      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {t("videoFailed")}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-label={t("watch")}
        onClose={() => setPlayerUrl(null)}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="text-card-foreground m-auto w-full max-w-3xl rounded-xl border bg-card p-4 backdrop:bg-black/60"
      >
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="ghost" onClick={close}>
            {t("closePlayer")}
          </Button>
        </div>
        {playerUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
            <iframe
              src={playerUrl}
              title={t("watch")}
              data-testid="library-player"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        )}
      </dialog>
    </div>
  );
}
