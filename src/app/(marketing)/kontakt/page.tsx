import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ContactForm } from "./contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Contact");
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: "/kontakt" },
  };
}

export default async function ContactPage() {
  const t = await getTranslations("Contact");
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-primary">
        {t("title")}
      </h1>
      <p className="mt-3 text-muted-foreground">{t("intro")}</p>
      <div className="mt-8">
        <ContactForm />
      </div>
    </main>
  );
}
