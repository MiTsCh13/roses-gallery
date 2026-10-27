import { useTranslations } from "next-intl";

export default function CheckEmailPage() {
  const t = useTranslations("CheckEmail");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-2 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
    </main>
  );
}
