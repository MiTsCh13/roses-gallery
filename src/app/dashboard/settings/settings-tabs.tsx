"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SettingsTab = { href: string; label: string };

export function SettingsTabs({
  tabs,
  label,
}: {
  tabs: SettingsTab[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex gap-1 border-b text-sm">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "-mb-px border-b-2 border-primary px-4 py-2 font-medium text-primary"
                : "px-4 py-2 text-muted-foreground hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
