import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  fillLegalText,
  hasMissingLegalDetails,
  legalDetails,
} from "@/lib/legal-details";

export type LegalKey = "impressum" | "datenschutz" | "agb";

type Section = { heading: string; paragraphs: string[] };

async function LegalBody({ page }: { page: LegalKey }) {
  await connection();
  const t = await getTranslations("Legal");
  const details = legalDetails();
  const sections = t.raw(`${page}.sections`) as Section[];
  return (
    <>
      {hasMissingLegalDetails(details) ? (
        <p role="note" className="mt-4 text-sm text-muted-foreground">
          {t("draft")}
        </p>
      ) : null}
      {sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="mt-2 leading-relaxed whitespace-pre-line"
            >
              {fillLegalText(paragraph, details)}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}

export async function LegalPage({ page }: { page: LegalKey }) {
  const t = await getTranslations("Legal");
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t(`${page}.title`)}
      </h1>
      <Suspense fallback={null}>
        <LegalBody page={page} />
      </Suspense>
      <Link href="/" className="mt-10 inline-block text-sm underline">
        {t("back")}
      </Link>
    </main>
  );
}
