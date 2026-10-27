"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the server component tree every few seconds while `active`. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
