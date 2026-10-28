"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import type { GalleryViewTile } from "./gallery-grid";

const SWIPE_MIN_PX = 50;

/** Fullscreen photo viewer: arrow keys, swipe, Escape and buttons. */
export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: GalleryViewTile[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("PublicGallery");
  const touchX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = photos.length;
  const photo = photos[index];

  const prev = () => onIndex((index - 1 + count) % count);
  const next = () => onIndex((index + 1) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onIndex((index - 1 + count) % count);
      else if (e.key === "ArrowRight") onIndex((index + 1) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onIndex, onClose]);

  // focus the close button, lock page scroll, restore both on unmount
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  if (!photo) return null;
  const btn =
    "absolute rounded-full bg-black/50 px-3 py-2 text-xl text-white hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("lightbox")}
      data-testid="lightbox"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start === null || count < 2) return;
        const dx = e.changedTouches[0].clientX - start;
        if (dx <= -SWIPE_MIN_PX) next();
        else if (dx >= SWIPE_MIN_PX) prev();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs bypass next/image */}
      <img
        src={photo.src}
        srcSet={photo.srcSet}
        sizes="100vw"
        alt={photo.alt ?? ""}
        data-testid="lightbox-image"
        className="max-h-full max-w-full object-contain"
      />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className={`${btn} top-4 right-4`}
      >
        ×
      </button>
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label={t("previous")}
            className={`${btn} top-1/2 left-4 -translate-y-1/2`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            aria-label={t("next")}
            className={`${btn} top-1/2 right-4 -translate-y-1/2`}
          >
            ›
          </button>
        </>
      )}
      <p
        aria-live="polite"
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white"
      >
        {t("position", { current: index + 1, total: count })}
      </p>
    </div>
  );
}
