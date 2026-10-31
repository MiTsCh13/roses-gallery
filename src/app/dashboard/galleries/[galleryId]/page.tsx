import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
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
import { DialogButton } from "@/components/dialog-button";
import { GalleryMediaPanel } from "@/components/gallery-media-panel";
import { listAddableMedia, listGalleryMedia } from "@/lib/library";
import {
  saveWatermarkAction,
  sendDeliveryMailAction,
  setGalleryPasswordAction,
  updateGalleryAction,
} from "../actions";

function Block({
  id,
  title,
  className,
  open = true,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      className="group rounded-xl border bg-card p-4"
    >
      <summary className="cursor-pointer text-base font-medium">
        {title}
      </summary>
      <div className={`mt-4 space-y-3 ${className ?? ""}`}>{children}</div>
    </details>
  );
}

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

  const [inGallery, addable] = await Promise.all([
    listGalleryMedia({ db: db(), accountId: account.id }, gallery.id),
    listAddableMedia({ db: db(), accountId: account.id }, gallery.id),
  ]);
  const watermark = readWatermarkConfig(account.branding);
  const deliveries = await listDeliveries(db(), account.id, gallery.id);
  const [stats7, stats30] = await Promise.all([
    galleryStats(db(), account.id, gallery.id, 7),
    galleryStats(db(), account.id, gallery.id, 30),
  ]);

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-6 py-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Link href="/dashboard/galleries" className="text-sm underline">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {gallery.title}
        </h1>
        <Link
          href={`/g/${gallery.slug}`}
          target="_blank"
          className="text-sm underline"
        >
          {t("view")}
        </Link>
        <DialogButton
          label={t("deliveryOpen")}
          title={t("deliveryTitle")}
          closeLabel={t("close")}
        >
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
        </DialogButton>
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

        <Block id="stats-title" className="space-y-3" title={t("statsTitle")}>
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
        </Block>

        <form action={updateGalleryAction} className="space-y-4">
          <input type="hidden" name="galleryId" value={gallery.id} />
          <input type="hidden" name="slug" value={gallery.slug} />
          <Block id="general-block" title={t("blockGeneral")} open>
            <label className="block space-y-1 text-sm">
              <span>{t("fieldTitle")}</span>
              <Input name="title" defaultValue={gallery.title} required />
            </label>
            <label className="block space-y-1 text-sm">
              <span>{t("fieldEventDate")}</span>
              <Input
                name="eventDate"
                type="date"
                defaultValue={isoDay(gallery.eventDate)}
              />
            </label>
          </Block>
          <Block id="access-block" title={t("blockAccess")} open>
            <label className="block space-y-1 text-sm">
              <span>{t("fieldExpiresAt")}</span>
              <Input
                name="expiresAt"
                type="date"
                defaultValue={isoDay(gallery.expiresAt)}
              />
              <span className="block text-xs text-muted-foreground">
                {t("expiresHint")}
              </span>
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
          </Block>
          <Block id="downloads-block" title={t("downloadTitle")} open>
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
          </Block>
          <Button type="submit">{t("save")}</Button>
        </form>

        {gallery.watermarkEnabled && (
          <Block
            id="watermark-title"
            className="max-w-md space-y-3"
            title={t("watermarkTitle")}
          >
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
          </Block>
        )}

        <Block
          id="password-title"
          className="max-w-md space-y-3"
          title={t("passwordTitle")}
        >
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
        </Block>
      </div>
      <GalleryMediaPanel
        galleryId={gallery.id}
        coverMediaId={gallery.coverMediaId}
        inGallery={inGallery.map((m) => ({ id: m.id, type: m.type }))}
        addable={addable.map((m) => ({ id: m.id, type: m.type }))}
      />
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
