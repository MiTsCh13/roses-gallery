import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

const NAV = [
  { href: "/dashboard/galleries", key: "galleries" },
  { href: "/dashboard/settings", key: "settings" },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("Dashboard");
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3">
          <Link
            href="/dashboard"
            className="font-display text-lg font-semibold text-primary"
          >
            {t("brand")}
          </Link>
          <nav
            aria-label={t("navLabel")}
            className="flex flex-1 gap-1 overflow-x-auto text-sm"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
