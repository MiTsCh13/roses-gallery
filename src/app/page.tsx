import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  const t = useTranslations("HomePage");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t("title")}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t("tagline")}</p>
      <Button disabled>{t("cta")}</Button>
    </main>
  );
}
