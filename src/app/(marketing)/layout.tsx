import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { LEGAL_MISSING, legalDetails } from "@/lib/legal-details";

import { MobileMenu } from "./mobile-menu";
import { BetaBadge } from "@/components/beta-badge";
import { BrandMark } from "@/components/brand-mark";

const MARKETING_NAV = [
  { href: "/#funktionen", key: "features" },
  { href: "/preise", key: "pricing" },
  { href: "/blog", key: "blog" },
] as const;

const LEGAL_LINKS = ["impressum", "datenschutz", "agb"] as const;

async function ContactLink() {
  await connection();
  const t = await getTranslations("Marketing");
  const email = legalDetails().LEGAL_EMAIL;
  if (email === LEGAL_MISSING) return null;
  return (
    <li>
      <Link href="/kontakt" className="hover:text-foreground">
        {t("footer.contact")}
      </Link>
    </li>
  );
}

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("Marketing");
  const tLegal = await getTranslations("Legal");
  const tAudience = await getTranslations("Audience.common");
  const navLinkClass =
    "rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-lg font-semibold text-primary"
          >
            <BrandMark className="size-7 shrink-0" />
            {t("brand")}
            <BetaBadge />
          </Link>
          <nav
            aria-label={t("nav.label")}
            className="hidden flex-1 gap-1 text-sm md:flex"
          >
            {MARKETING_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass}>
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t("nav.signIn")}</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/login">{t("nav.start")}</Link>
            </Button>
          </div>
          <MobileMenu label={t("nav.menu")}>
            <nav
              aria-label={t("nav.mobileLabel")}
              className="absolute right-0 mt-2 flex w-56 flex-col gap-1 rounded-2xl border bg-card p-2 text-sm shadow-lg"
            >
              {MARKETING_NAV.map((item) => (
                <Link key={item.href} href={item.href} className={navLinkClass}>
                  {t(`nav.${item.key}`)}
                </Link>
              ))}
              <Link href="/login" className={navLinkClass}>
                {t("nav.signIn")}
              </Link>
              <Button asChild size="sm" className="mt-1 rounded-full">
                <Link href="/login">{t("nav.start")}</Link>
              </Button>
            </nav>
          </MobileMenu>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t bg-card/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t("footer.tagline")}</p>
          <nav aria-label={t("footer.label")}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              <li>
                <Link href="/fuer-fotografen" className="hover:text-foreground">
                  {tAudience("forPhotographers")}
                </Link>
              </li>
              <li>
                <Link
                  href="/fuer-videografen"
                  className="hover:text-foreground"
                >
                  {tAudience("forVideographers")}
                </Link>
              </li>
              {LEGAL_LINKS.map((key) => (
                <li key={key}>
                  <Link href={`/${key}`} className="hover:text-foreground">
                    {tLegal(`${key}.linkLabel`)}
                  </Link>
                </li>
              ))}
              <Suspense fallback={null}>
                <ContactLink />
              </Suspense>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
