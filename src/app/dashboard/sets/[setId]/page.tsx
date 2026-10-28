import { Suspense } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { AutoRefresh } from "@/components/auto-refresh";
import { PhotoUploader } from "@/components/photo-uploader";
import { VideoPreview } from "@/components/video-preview";
import { VideoUploader } from "@/components/video-uploader";
import { db } from "@/db";
import { media } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { formatBytes } from "@/lib/format";
import { requireAccount } from "@/lib/session";
import { getVideoProvider } from "@/lib/video";
import { syncVideo } from "@/lib/videos";

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
  if (!set) notFound();
  if (set.type === "video")
    return <VideoSet set={set} accountId={account.id} />;

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

async function VideoSet({
  set,
  accountId,
}: {
  set: { id: string; title: string };
  accountId: string;
}) {
  const t = await getTranslations("VideoUpload");
  const deps = { db: db(), video: getVideoProvider(), accountId };

  // Bunny's webhook may be late or missing: pull the state of open videos.
  const open = await tenantDb(deps.db, accountId).media.list(
    and(
      eq(media.setId, set.id),
      inArray(media.processingStatus, ["pending", "processing"]),
    ),
  );
  await Promise.all(open.map((v) => syncVideo(deps, v.id).catch(() => null)));

  const videos = (
    await tenantDb(deps.db, accountId).media.list(eq(media.setId, set.id))
  ).sort((a, b) => a.position - b.position);
  const processing = videos.some(
    (v) =>
      v.processingStatus === "pending" || v.processingStatus === "processing",
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{set.title}</h1>
      <VideoUploader setId={set.id} />
      <section aria-labelledby="videos-title" className="space-y-3">
        <h2 id="videos-title" className="text-lg font-medium">
          {t("videos", { count: videos.length })}
        </h2>
        <AutoRefresh active={processing} />
        <ul className="space-y-2" data-testid="video-list">
          {videos.map((v, i) => (
            <li
              key={v.id}
              data-status={v.processingStatus}
              data-id={v.id}
              className="space-y-2 rounded-md border p-3 text-sm"
            >
              <div className="flex justify-between">
                <span>{t("videoN", { n: i + 1 })}</span>
                <span className="text-muted-foreground">
                  {formatBytes(v.sizeBytes)} ·{" "}
                  {t(`status.${v.processingStatus}`)}
                </span>
              </div>
              {v.processingStatus === "ready" && (
                <VideoPreview mediaId={v.id} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
