"use client";

import { useRef } from "react";

/** Natives `<details>`-Menü für kleine Bildschirme; schließt nach Klick auf einen Link. */
export function MobileMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className="relative ml-auto md:hidden"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) {
          ref.current?.removeAttribute("open");
        }
      }}
    >
      <summary className="cursor-pointer list-none rounded-full border px-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      {children}
    </details>
  );
}
