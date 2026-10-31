import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { DesignEditor } from "@/components/design-editor";
import { db } from "@/db";
import { tenantDb } from "@/db/tenant";
import { GalleryError } from "@/lib/galleries";
import { logoUrl } from "@/lib/branding";
import { getStorage } from "@/lib/storage";
import { galleryDesign } from "@/lib/gallery-design";
import { requireAccount } from "@/lib/session";
import { removeLogoAction, saveDesignAction } from "../../actions";

const PLACEHOLDER_TILES = 8;

async function DesignContent({
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
    getTranslations("Design"),
  ]);
  if (!z.uuid().safeParse(galleryId).success) notFound();
  const deps = { db: db(), accountId: account.id };
  const tenant = tenantDb(deps.db, account.id);
  const gallery = await tenant.galleries.get(galleryId);
  if (!gallery) notFound();
  const design = await galleryDesign(deps, gallery.id).catch((e) => {
    if (e instanceof GalleryError) notFound();
    throw e;
  });
  const logo = await logoUrl({ ...deps, storage: getStorage() });
  const previewTiles = Array.from({ length: PLACEHOLDER_TILES }, (_, n) => ({
    id: `placeholder-${n}`,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-16">
      <Link
        href={`/dashboard/galleries/${gallery.id}`}
        className="text-sm underline"
      >
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("title")} – {gallery.title}
      </h1>
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
      <DesignEditor
        galleryId={gallery.id}
        title={gallery.title}
        themes={design.themes}
        initialThemeId={design.themeId}
        initialConfig={design.config}
        logoUrl={logo ?? undefined}
        tiles={previewTiles}
        action={saveDesignAction}
        removeLogoAction={removeLogoAction}
      />
    </main>
  );
}

export default function DesignPage(props: {
  params: Promise<{ galleryId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  return (
    <Suspense>
      <DesignContent {...props} />
    </Suspense>
  );
}
