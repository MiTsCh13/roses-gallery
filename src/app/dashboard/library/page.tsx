import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { AutoRefresh } from "@/components/auto-refresh";
import { LibraryBrowser } from "@/components/library-browser";
import { db } from "@/db";
import { tenantDb } from "@/db/tenant";
import { folderPath, LibraryError, listFolder } from "@/lib/library";
import { requireAccount } from "@/lib/session";
import { getVideoProvider } from "@/lib/video";
import { syncVideo } from "@/lib/videos";

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  await connection();
  const [{ folder }, { account }, t] = await Promise.all([
    searchParams,
    requireAccount(),
    getTranslations("Library"),
  ]);
  if (folder !== undefined && !z.uuid().safeParse(folder).success) notFound();

  const deps = { db: db(), accountId: account.id };
  const content = await listFolder(deps, folder ?? null).catch((e) => {
    if (e instanceof LibraryError) notFound();
    throw e;
  });

  // Bunny's webhook may be late: pull the state of open videos ourselves.
  const open = content.media.filter(
    (m) =>
      m.type === "video" &&
      (m.processingStatus === "pending" || m.processingStatus === "processing"),
  );
  const video = getVideoProvider();
  await Promise.all(
    open.map((v) => syncVideo({ ...deps, video }, v.id).catch(() => null)),
  );
  const media = open.length
    ? (await listFolder(deps, folder ?? null)).media
    : content.media;
  const processing = media.some(
    (m) =>
      m.processingStatus === "pending" || m.processingStatus === "processing",
  );
  const path = folder ? await folderPath(deps, folder) : [];
  const all = await tenantDb(deps.db, account.id).folders.list();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <AutoRefresh active={processing} />
      <LibraryBrowser
        folderId={folder ?? null}
        path={path}
        folders={content.folders.map((f) => ({ id: f.id, name: f.name }))}
        allFolders={all.map((f) => ({ id: f.id, name: f.name }))}
        media={media.map((m) => ({
          id: m.id,
          type: m.type,
          status: m.processingStatus,
          sizeBytes: m.sizeBytes,
        }))}
      />
    </main>
  );
}

export default function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  return (
    <Suspense>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
