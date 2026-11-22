import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Check,
  Download,
  Heart,
  Mail,
  Palette,
  PiggyBank,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type TextBlock = { title: string; text: string };

const FEATURE_ICONS = [Palette, Download, Heart, Mail, ShieldCheck, PiggyBank];

export default function HomePage() {
  const t = useTranslations("HomePage");
  const highlights = t.raw("highlights") as string[];
  const features = t.raw("features") as TextBlock[];
  const steps = t.raw("steps") as TextBlock[];
  const faq = t.raw("faq") as { q: string; a: string }[];
  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-gradient-to-b from-accent/60 via-background to-background px-4 py-20 text-center sm:px-6 sm:py-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          <p className="rounded-full bg-secondary px-4 py-1 text-sm text-secondary-foreground">
            {t("eyebrow")}
          </p>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-primary sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {t("tagline")}
          </p>
          <ul className="mt-6 flex flex-col gap-2 text-left text-sm sm:items-center">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check aria-hidden className="mt-0.5 size-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/login">{t("cta")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full"
            >
              <Link href="#funktionen">{t("secondaryCta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="funktionen"
        aria-labelledby="funktionen-titel"
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6"
      >
        <h2
          id="funktionen-titel"
          className="text-center font-display text-3xl font-semibold tracking-tight"
        >
          {t("featuresTitle")}
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? Check;
            return (
              <li
                key={f.title}
                className="rounded-2xl border bg-card p-6 shadow-xs"
              >
                <Icon aria-hidden className="size-6 text-primary" />
                <h3 className="mt-3 font-display text-lg font-semibold">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="schritte-titel"
        className="bg-accent/40 px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <h2
            id="schritte-titel"
            className="text-center font-display text-3xl font-semibold tracking-tight"
          >
            {t("stepsTitle")}
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                >
                  {i + 1}
                </span>
                <h3 className="font-display text-lg font-semibold">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="faq-titel"
        className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6"
      >
        <h2
          id="faq-titel"
          className="text-center font-display text-3xl font-semibold tracking-tight"
        >
          {t("faqTitle")}
        </h2>
        <div className="mt-8 divide-y rounded-2xl border bg-card">
          {faq.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="cursor-pointer font-medium">{item.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            {t("closingTitle")}
          </h2>
          <p className="mt-3 opacity-90">{t("closingText")}</p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-6 rounded-full"
          >
            <Link href="/login">{t("cta")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
