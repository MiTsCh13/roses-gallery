"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { requestZipAction, startZipAction } from "@/app/g/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const POLL_MS = 2000;
const MAX_POLLS = 300; // ~10 minutes

type Phase = "idle" | "building" | "failed";

/** ZIP of the whole gallery: direct download in the browser, or the link by mail. */
export function ZipDownload({
  slug,
  sizes,
  result,
}: {
  slug: string;
  /** Sizes the download policy permits; the first one is preselected. */
  sizes: ("original" | "web")[];
  /** Outcome code of the mail form (redirect query). */
  result?: string;
}) {
  const t = useTranslations("PublicGallery");
  const [size, setSize] = useState(sizes[0]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);
  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  const start = async () => {
    setPhase("building");
    setError(null);
    const started = await startZipAction(slug, size);
    if (!started.ok) {
      setPhase("idle");
      setError(started.reason);
      return;
    }
    const base = `/api/g/${encodeURIComponent(slug)}/zip/${started.exportId}`;
    for (let i = 0; i < MAX_POLLS && !cancelled.current; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        const res = await fetch(`${base}/status`, { cache: "no-store" });
        const { status } = (await res.json()) as { status: string };
        if (status === "ready") {
          setPhase("idle");
          // the route answers with a redirect to the signed file
          const a = document.createElement("a");
          a.href = base;
          a.click();
          return;
        }
        if (status === "failed" || status === "gone") break;
      } catch {
        // transient network error: keep polling
      }
    }
    if (!cancelled.current) setPhase("failed");
  };

  const code = error ?? (phase === "failed" ? "failed" : result);
  const message = code
    ? t.has(`zipResult.${code}`)
      ? t(`zipResult.${code}`)
      : t("zipResult.invalid")
    : null;

  return (
    <section className="mx-auto w-full max-w-xl space-y-3 px-6 py-10">
      <h2 className="text-lg font-semibold">{t("zipTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("zipIntro")}</p>
      {message && (
        <p
          role={code === "sent" ? "status" : "alert"}
          className={code === "sent" ? "text-sm" : "text-sm text-destructive"}
        >
          {message}
        </p>
      )}
      <label className="block space-y-1 text-sm">
        <span>{t("zipSize")}</span>
        <select
          name="size"
          value={size}
          onChange={(e) => setSize(e.target.value as "original" | "web")}
          className="h-9 w-full rounded-md border bg-background px-2"
        >
          {sizes.includes("original") && (
            <option value="original">{t("zipOriginal")}</option>
          )}
          {sizes.includes("web") && <option value="web">{t("zipWeb")}</option>}
        </select>
      </label>
      <Button
        type="button"
        onClick={start}
        disabled={phase === "building"}
        data-testid="zip-direct"
      >
        {phase === "building" ? t("zipBuilding") : t("zipDirect")}
      </Button>
      <details className="pt-2 text-sm">
        <summary className="cursor-pointer">{t("zipByMail")}</summary>
        <form action={requestZipAction} className="mt-3 space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="size" value={size} />
          <label className="block space-y-1">
            <span>{t("zipEmail")}</span>
            <Input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <Button type="submit" variant="outline">
            {t("zipSubmit")}
          </Button>
        </form>
      </details>
    </section>
  );
}
