import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { AutoRefresh } from "@/components/auto-refresh";
import { PhotoUploader } from "@/components/photo-uploader";
import { db } from "@/db";
import { media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { formatBytes } from "@/lib/format";
import { requireAccount } from "@/lib/session";

async function SetContent({ params }: { params: Promise<{ setId: string }> }) {
  await connection();
  const [{ setId }, { account }, t] = await Promise.all([
    params,
    requireAccount(),
    getTranslations("Upload"),
  ]);
  if (!z.uuid().safeParse(setId).success) notFound();

  const tenant = tenantDb(db(), account.id);
  const set = await tenant.sets.get(setId);
  if (!set || set.type !== "photo") notFound();

  const photos = (await tenant.media.list(eq(media.setId, set.id))).sort(
    (a, b) => a.position - b.position,
  );
  const processing = photos.some(
    (p) =>
      p.processingStatus === "pending" || p.processingStatus === "processing",
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{set.title}</h1>
      <PhotoUploader setId={set.id} />
      <section aria-labelledby="photos-title" className="space-y-3">
        <h2 id="photos-title" className="text-lg font-medium">
          {t("photos", { count: photos.length })}
        </h2>
        <AutoRefresh active={processing} />
        <ul className="space-y-2" data-testid="photo-list">
          {photos.map((p, i) => (
            <li
              key={p.id}
              data-status={p.processingStatus}
              className="flex justify-between rounded-md border p-3 text-sm"
            >
              <span>{t("photoN", { n: i + 1 })}</span>
              <span className="text-muted-foreground">
                {formatBytes(p.sizeBytes)} · {t(`status.${p.processingStatus}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default function SetPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  return (
    <Suspense>
      <SetContent params={params} />
    </Suspense>
  );
}
