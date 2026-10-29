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
import {
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  listDeliveries,
} from "@/lib/delivery-mail";
import { DOWNLOAD_POLICIES } from "@/lib/download-policy";
import { readWatermarkConfig, WATERMARK_POSITIONS } from "@/lib/watermark";
import { EVENT_TYPES, galleryStats } from "@/lib/events";
import { requireAccount } from "@/lib/session";
import { SortableList } from "@/components/sortable-list";
import {
  createSetAction,
  reorderSetsAction,
  saveWatermarkAction,
  sendDeliveryMailAction,
  setGalleryPasswordAction,
  updateGalleryAction,
} from "../actions";

const STATUSES = ["draft", "published", "expired", "archived"] as const;
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

async function GalleryContent({
  params,
  searchParams,
}: {
  params: Promise<{ galleryId: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    sent?: string;
    failed?: string;
  }>;
}) {
  await connection();
  const [{ galleryId }, { error, saved, sent, failed }, { account }, t] =
    await Promise.all([
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

  const watermark = readWatermarkConfig(account.branding);
  const deliveries = await listDeliveries(db(), account.id, gallery.id);
  const [stats7, stats30] = await Promise.all([
    galleryStats(db(), account.id, gallery.id, 7),
    galleryStats(db(), account.id, gallery.id, 30),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <Link href="/dashboard/galleries" className="text-sm underline">
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{gallery.title}</h1>
      <Link
        href={`/dashboard/galleries/${gallery.id}/design`}
        className="text-sm underline"
      >
        {t("design")}
      </Link>
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

      {sent !== undefined && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("deliverySent", { sent: Number(sent) || 0 })}
          {Number(failed) > 0 &&
            ` ${t("deliveryFailed", { failed: Number(failed) })}`}
        </p>
      )}

      <section aria-labelledby="stats-title" className="space-y-3">
        <h2 id="stats-title" className="text-lg font-medium">
          {t("statsTitle")}
        </h2>
        <table className="text-sm" data-testid="gallery-stats">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pr-6 font-normal" />
              <th className="pr-6 font-normal">{t("stats7")}</th>
              <th className="font-normal">{t("stats30")}</th>
            </tr>
          </thead>
          <tbody>
            {EVENT_TYPES.map((type) => (
              <tr key={type}>
                <th scope="row" className="pr-6 text-left font-normal">
                  {t(`statsType.${type}`)}
                </th>
                <td className="pr-6">{stats7[type]}</td>
                <td>{stats30[type]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">{t("statsPrivacy")}</p>
      </section>

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
        <label className="block space-y-1 text-sm">
          <span>{t("downloadGallery")}</span>
          <select
            name="downloadPolicy"
            defaultValue={gallery.downloadPolicy}
            className="h-9 w-full rounded-md border bg-transparent px-3"
          >
            {DOWNLOAD_POLICIES.map((p) => (
              <option key={p} value={p}>
                {t(`download.${p}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="watermarkEnabled"
            defaultChecked={gallery.watermarkEnabled}
          />
          <span>{t("watermarkEnable")}</span>
        </label>
        <Button type="submit">{t("save")}</Button>
      </form>

      <section aria-labelledby="watermark-title" className="max-w-md space-y-3">
        <h2 id="watermark-title" className="text-lg font-medium">
          {t("watermarkTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {typeof account.branding.logoKey === "string"
            ? t("watermarkHint")
            : t("watermarkNoLogo")}
        </p>
        <form action={saveWatermarkAction} className="space-y-3">
          <input type="hidden" name="galleryId" value={gallery.id} />
          <label className="block space-y-1 text-sm">
            <span>{t("watermarkPosition")}</span>
            <select
              name="position"
              defaultValue={watermark.position}
              className="h-9 w-full rounded-md border bg-transparent px-3"
            >
              {WATERMARK_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {t(`watermarkPositions.${p}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>{t("watermarkOpacity")}</span>
            <Input
              name="opacity"
              type="number"
              min={5}
              max={100}
              defaultValue={watermark.opacity}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{t("watermarkScale")}</span>
            <Input
              name="scale"
              type="number"
              min={5}
              max={60}
              defaultValue={watermark.scale}
            />
          </label>
          <Button type="submit" variant="outline">
            {t("watermarkSave")}
          </Button>
        </form>
      </section>

      <section aria-labelledby="delivery-title" className="max-w-md space-y-3">
        <h2 id="delivery-title" className="text-lg font-medium">
          {t("deliveryTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("deliveryHint")}</p>
        <form action={sendDeliveryMailAction} className="space-y-3">
          <input type="hidden" name="galleryId" value={gallery.id} />
          <label className="block space-y-1 text-sm">
            <span>{t("deliveryRecipients")}</span>
            <textarea
              name="recipients"
              required
              rows={2}
              maxLength={2000}
              className="w-full rounded-md border bg-transparent px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{t("deliverySubject")}</span>
            <Input
              name="subject"
              required
              maxLength={200}
              defaultValue={DEFAULT_SUBJECT}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{t("deliveryBody")}</span>
            <textarea
              name="body"
              required
              rows={10}
              maxLength={5000}
              defaultValue={DEFAULT_BODY}
              className="w-full rounded-md border bg-transparent px-3 py-2"
            />
          </label>
          <Button type="submit">{t("deliverySend")}</Button>
        </form>
        <h3 className="text-sm font-medium">{t("deliveryLog")}</h3>
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("deliveryLogEmpty")}
          </p>
        ) : (
          <ul className="space-y-1 text-sm" data-testid="delivery-log">
            {deliveries.map((d) => (
              <li key={d.id}>
                {d.recipient} – {t(`deliveryStatus.${d.status}`)} (
                {d.createdAt.toLocaleString("de-DE")})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="password-title" className="max-w-md space-y-3">
        <h2 id="password-title" className="text-lg font-medium">
          {t("passwordTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {gallery.passwordHash ? t("passwordOn") : t("passwordOff")}
        </p>
        <form
          action={setGalleryPasswordAction}
          className="flex flex-wrap gap-2"
        >
          <input type="hidden" name="galleryId" value={gallery.id} />
          <Input
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={200}
            autoComplete="new-password"
            placeholder={t("passwordNew")}
            aria-label={t("passwordNew")}
            className="max-w-xs"
          />
          <Button type="submit" variant="outline">
            {t("passwordSet")}
          </Button>
        </form>
        {gallery.passwordHash && (
          <form action={setGalleryPasswordAction}>
            <input type="hidden" name="galleryId" value={gallery.id} />
            <input type="hidden" name="intent" value="remove" />
            <Button type="submit" variant="ghost">
              {t("passwordRemove")}
            </Button>
          </form>
        )}
      </section>

      <section aria-labelledby="sets-title" className="space-y-3">
        <h2 id="sets-title" className="text-lg font-medium">
          {t("sets", { count: gallerySets.length })}
        </h2>
        <SortableList
          testId="set-list"
          items={gallerySets.map((s) => ({
            id: s.id,
            label: s.title,
            detail: t(`setType.${s.type}`),
            extra: (
              <Link href={`/dashboard/sets/${s.id}`} className="underline">
                {t("open")}
              </Link>
            ),
          }))}
          onReorder={reorderSetsAction.bind(null, gallery.id)}
          labels={{ up: t("moveUp"), down: t("moveDown"), handle: t("drag") }}
        />
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
  searchParams: Promise<{
    error?: string;
    saved?: string;
    sent?: string;
    failed?: string;
  }>;
}) {
  return (
    <Suspense>
      <GalleryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
