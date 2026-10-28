import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { formatBytes } from "@/lib/format";
import { galleryOverview } from "@/lib/galleries";
import { requireAccount } from "@/lib/session";

async function GalleriesContent() {
  await connection();
  const [t, { account }] = await Promise.all([
    getTranslations("Galleries"),
    requireAccount(),
  ]);
  const rows = await galleryOverview({ db: db(), accountId: account.id });
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("de-DE") : "–");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Link
          href="/dashboard/galleries/new"
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          {t("new")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2" data-testid="gallery-list">
          {rows.map((g) => (
            <li key={g.id} className="rounded-md border p-4">
              <Link
                href={`/dashboard/galleries/${g.id}`}
                className="font-medium underline"
              >
                {g.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                {t(`status.${g.status}`)} ·{" "}
                {t("media", { count: g.mediaCount })} ·{" "}
                {formatBytes(g.storageBytes)} ·{" "}
                {t("expires", { date: fmt(g.expiresAt) })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function GalleriesPage() {
  return (
    <Suspense>
      <GalleriesContent />
    </Suspense>
  );
}
