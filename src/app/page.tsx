import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

function LegalLinks() {
  const t = useTranslations("Legal");
  return (
    <nav className="mt-16 flex gap-6 text-sm text-muted-foreground">
      <Link href="/impressum">{t("impressum.linkLabel")}</Link>
      <Link href="/datenschutz">{t("datenschutz.linkLabel")}</Link>
      <Link href="/agb">{t("agb.linkLabel")}</Link>
    </nav>
  );
}

export default function HomePage() {
  const t = useTranslations("HomePage");
  const features = t.raw("features") as { title: string; text: string }[];
  return (
    <main className="flex flex-1 flex-col items-center bg-gradient-to-b from-accent/60 via-background to-background px-6 py-24 text-center">
      <p className="rounded-full bg-secondary px-4 py-1 text-sm text-secondary-foreground">
        {t("eyebrow")}
      </p>
      <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-primary sm:text-6xl">
        {t("title")}
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">
        {t("tagline")}
      </p>
      <Button disabled size="lg" className="mt-8 rounded-full">
        {t("cta")}
      </Button>
      <ul className="mt-16 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
        {features.map((f) => (
          <li
            key={f.title}
            className="rounded-2xl border bg-card p-6 shadow-xs"
          >
            <h2 className="font-display text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
          </li>
        ))}
      </ul>
      <LegalLinks />
    </main>
  );
}
