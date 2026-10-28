import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { sets } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { requireAccount } from "@/lib/session";
import { createSetAction, updateGalleryAction } from "../actions";

const STATUSES = ["draft", "published", "expired", "archived"] as const;
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

async function GalleryContent({
  params,
  searchParams,
}: {
  params: Promise<{ galleryId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await connection();
  const [{ galleryId }, { error, saved }, { account }, t] = await Promise.all([
    params,
    searchParams,
    requireAccount(),
    getTranslations("Galleries"),
  ]);
  if (!z.uuid().safeParse(galleryId).success) notFound();
  const tenant = tenantDb(db(), account.id);
  const gallery = await tenant.galleries.get(galleryId);
  if (!gallery) notFound();
  const gallerySets = await tenant.sets.list(eq(sets.galleryId, gallery.id));
  gallerySets.sort((a, b) => a.position - b.position);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <Link href="/dashboard/galleries" className="text-sm underline">
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{gallery.title}</h1>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t.has(`error.${error}`) ? t(`error.${error}`) : t("error.invalid")}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("saved")}
        </p>
      )}

      <form action={updateGalleryAction} className="max-w-md space-y-4">
        <input type="hidden" name="galleryId" value={gallery.id} />
        <label className="block space-y-1 text-sm">
          <span>{t("fieldTitle")}</span>
          <Input name="title" defaultValue={gallery.title} required />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldSlug")}</span>
          <Input name="slug" defaultValue={gallery.slug} required />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldEventDate")}</span>
          <Input
            name="eventDate"
            type="date"
            defaultValue={isoDay(gallery.eventDate)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldExpiresAt")}</span>
          <Input
            name="expiresAt"
            type="date"
            defaultValue={isoDay(gallery.expiresAt)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldStatus")}</span>
          <select
            name="status"
            defaultValue={gallery.status}
            className="h-9 w-full rounded-md border bg-transparent px-3"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">{t("save")}</Button>
      </form>

      <section aria-labelledby="sets-title" className="space-y-3">
        <h2 id="sets-title" className="text-lg font-medium">
          {t("sets", { count: gallerySets.length })}
        </h2>
        <ul className="space-y-2" data-testid="set-list">
          {gallerySets.map((s) => (
            <li key={s.id} className="rounded-md border p-3 text-sm">
              <Link href={`/dashboard/sets/${s.id}`} className="underline">
                {s.title}
              </Link>{" "}
              <span className="text-muted-foreground">
                · {t(`setType.${s.type}`)}
              </span>
            </li>
          ))}
        </ul>
        <form action={createSetAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="galleryId" value={gallery.id} />
          <Input
            name="title"
            required
            maxLength={200}
            placeholder={t("setTitle")}
            aria-label={t("setTitle")}
            className="max-w-xs"
          />
          <select
            name="type"
            aria-label={t("setTypeLabel")}
            className="h-9 rounded-md border bg-transparent px-3"
          >
            <option value="photo">{t("setType.photo")}</option>
            <option value="video">{t("setType.video")}</option>
          </select>
          <Button type="submit" variant="outline">
            {t("addSet")}
          </Button>
        </form>
      </section>
    </main>
  );
}

export default function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ galleryId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  return (
    <Suspense>
      <GalleryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
