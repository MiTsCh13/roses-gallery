"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { recordPlayAction } from "@/app/g/[slug]/favorites-actions";
import { useFavorites } from "./favorites";
import { HlsPlayer } from "./hls-player";

export type GalleryViewVideo = {
  id: string;
  title: string;
  playUrl?: string;
  hlsUrl?: string;
  durationS?: number | null;
};

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * Netflix-style video area: a large hero player for the selected film and one
 * row of film tiles per video set. The signed embed URL is only put into an
 * iframe after the visitor presses play.
 */
export function VideoShelf({
  rows,
}: {
  rows: { id: string; title: string; videos: GalleryViewVideo[] }[];
}) {
  const t = useTranslations("PublicGallery");
  // the favorites context knows the public slug; absent in the editor preview
  const slug = useFavorites()?.slug;
  const play = (id: string) => {
    setPlaying(id);
    if (slug) void recordPlayAction(slug, id);
  };
  const all = rows.flatMap((r) => r.videos);
  const [selected, setSelected] = useState<string | null>(all[0]?.id ?? null);
  const [playing, setPlaying] = useState<string | null>(null);
  const hero = all.find((v) => v.id === selected) ?? all[0];
  if (!hero) return null;

  return (
    <div className="space-y-8" data-testid="video-shelf">
      <div
        className="relative aspect-video w-full overflow-hidden"
        style={{ background: "var(--g-muted)" }}
        data-testid="video-hero"
      >
        {playing === hero.id && hero.hlsUrl ? (
          <HlsPlayer
            key={hero.id}
            videoId={hero.id}
            src={hero.hlsUrl}
            title={hero.title}
          />
        ) : playing === hero.id && hero.playUrl ? (
          <iframe
            key={hero.id}
            src={hero.playUrl}
            title={hero.title}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => play(hero.id)}
            disabled={!hero.playUrl && !hero.hlsUrl}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 disabled:opacity-40"
            style={{
              background:
                "linear-gradient(135deg, var(--g-accent), var(--g-muted) 120%)",
              color: "var(--g-bg)",
            }}
          >
            <span className="text-5xl" aria-hidden>
              ▶
            </span>
            <span className="text-lg">{t("play", { title: hero.title })}</span>
          </button>
        )}
      </div>
      {rows.map((row) => (
        <section key={row.id} aria-label={row.title} className="space-y-3">
          <h2
            className="text-xl"
            style={{ fontFamily: "var(--g-font-heading)" }}
          >
            {row.title}
          </h2>
          <ul className="flex gap-[var(--g-gap)] overflow-x-auto pb-2">
            {row.videos.map((v) => (
              <li key={v.id} className="w-56 shrink-0 @lg:w-64">
                <button
                  type="button"
                  data-testid="video-tile"
                  aria-pressed={v.id === hero.id}
                  onClick={() => {
                    setSelected(v.id);
                    if (v.playUrl || v.hlsUrl) play(v.id);
                    else setPlaying(null);
                  }}
                  className="block w-full text-left"
                >
                  <span
                    className="flex aspect-video items-center justify-center text-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--g-accent), var(--g-muted) 120%)",
                      color: "var(--g-bg)",
                      outline:
                        v.id === hero.id ? "2px solid var(--g-accent)" : "none",
                      outlineOffset: 2,
                    }}
                    aria-hidden
                  >
                    ▶
                  </span>
                  <span className="mt-1 block text-sm">{v.title}</span>
                  {v.durationS != null && (
                    <span
                      className="block text-xs"
                      style={{ color: "var(--g-muted)" }}
                    >
                      {formatDuration(v.durationS)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
