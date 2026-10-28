import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAccount } from "@/lib/session";
import { createGalleryAction } from "../actions";

async function NewContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const [t, { error }] = await Promise.all([
    getTranslations("Galleries"),
    searchParams,
    requireAccount(),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("new")}</h1>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t.has(`error.${error}`) ? t(`error.${error}`) : t("error.invalid")}
        </p>
      )}
      <form action={createGalleryAction} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span>{t("fieldTitle")}</span>
          <Input name="title" required maxLength={200} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldSlug")}</span>
          <Input name="slug" maxLength={60} placeholder={t("slugHint")} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldEventDate")}</span>
          <Input name="eventDate" type="date" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldExpiresAt")}</span>
          <Input name="expiresAt" type="date" />
        </label>
        <Button type="submit">{t("create")}</Button>
      </form>
    </main>
  );
}

export default function NewGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense>
      <NewContent searchParams={searchParams} />
    </Suspense>
  );
}
