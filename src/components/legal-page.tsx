import Link from "next/link";
import { useTranslations } from "next-intl";

export type LegalKey = "impressum" | "datenschutz" | "agb";

export function LegalPage({ page }: { page: LegalKey }) {
  const t = useTranslations("Legal");
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t(`${page}.title`)}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("placeholder")}</p>
      <p className="mt-6 leading-relaxed">{t(`${page}.body`)}</p>
      <Link href="/" className="mt-10 inline-block text-sm underline">
        {t("back")}
      </Link>
    </main>
  );
}
