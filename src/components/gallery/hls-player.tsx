"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { detectCast, promptCast, type CastMethod } from "./cast";
import { readResume, writeResume } from "./resume-position";

type Level = { index: number; label: string };

/**
 * Adaptive HLS player: hls.js where Media Source Extensions exist, native HLS
 * otherwise (Safari/iOS, which also brings AirPlay). Native controls provide
 * fullscreen; quality selection and resume-at-last-position are added here.
 */
export function HlsPlayer({
  videoId,
  src,
  title,
}: {
  videoId: string;
  src: string;
  title: string;
}) {
  const t = useTranslations("PublicGallery");
  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1);
  const [failed, setFailed] = useState(false);
  const [cast, setCast] = useState<CastMethod | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    setCast(detectCast(video));

    const resume = () => {
      const at = readResume(videoId, video.duration);
      if (at) video.currentTime = at;
    };
    video.addEventListener("loadedmetadata", resume, { once: true });

    (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          setLevels(
            data.levels
              .map((l, index) => ({ index, label: `${l.height}p` }))
              .reverse(),
          );
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setFailed(true);
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else {
        setFailed(true);
      }
    })().catch(() => setFailed(true));

    const save = () =>
      writeResume(videoId, video.currentTime, video.duration || 0);
    video.addEventListener("pause", save);
    video.addEventListener("ended", save);
    const timer = setInterval(() => {
      if (!video.paused) save();
    }, 5000);

    return () => {
      cancelled = true;
      save();
      clearInterval(timer);
      video.removeEventListener("loadedmetadata", resume);
      video.removeEventListener("pause", save);
      video.removeEventListener("ended", save);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [videoId, src]);

  function pick(value: number) {
    setLevel(value);
    if (hlsRef.current) hlsRef.current.currentLevel = value;
  }

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={ref}
        title={title}
        controls
        autoPlay
        playsInline
        x-webkit-airplay="allow"
        className="h-full w-full"
        data-testid="hls-video"
      />
      {levels.length > 1 && (
        <label className="absolute top-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
          {t("quality")}{" "}
          <select
            value={level}
            onChange={(e) => pick(Number(e.target.value))}
            className="bg-transparent"
            data-testid="hls-quality"
          >
            <option value={-1}>{t("qualityAuto")}</option>
            {levels.map((l) => (
              <option key={l.index} value={l.index}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {cast && (
        <button
          type="button"
          onClick={() => ref.current && promptCast(ref.current, cast)}
          className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white"
          data-testid="hls-cast"
        >
          {t("cast")}
        </button>
      )}
      {failed && (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-sm text-white"
        >
          {t("playerError")}
        </p>
      )}
    </div>
  );
}
