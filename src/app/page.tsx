import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

function LegalLinks() {
  const t = useTranslations("Legal");
  return (
    <nav className="mt-12 flex gap-6 text-sm text-muted-foreground">
      <Link href="/impressum">{t("impressum.linkLabel")}</Link>
      <Link href="/datenschutz">{t("datenschutz.linkLabel")}</Link>
      <Link href="/agb">{t("agb.linkLabel")}</Link>
    </nav>
  );
}

export default function HomePage() {
  const t = useTranslations("HomePage");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t("title")}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t("tagline")}</p>
      <Button disabled>{t("cta")}</Button>
      <LegalLinks />
    </main>
  );
}
