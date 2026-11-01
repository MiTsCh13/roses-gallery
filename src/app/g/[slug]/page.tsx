import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  FavoritesPanel,
  FavoritesProvider,
} from "@/components/gallery/favorites";
import {
  EMPTY_STATE,
  loadFavoriteState,
  resolveVisitor,
  visitorCookieName,
} from "@/lib/favorites";
import { ShareLinkButton } from "@/components/gallery/share";
import { ZipDownload } from "@/components/gallery/zip-download";
import { GalleryView } from "@/components/gallery/gallery-view";
import { db } from "@/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { serverEnv } from "@/lib/env";
import { recordEvent } from "@/lib/events";
import { loadPublicGallery } from "@/lib/public-gallery";
import { getStorage } from "@/lib/storage";
import { getVideoProvider } from "@/lib/video";
import { accessCookieName } from "@/lib/gallery-access";
import { unlockGalleryAction } from "./actions";

// Never index client galleries.
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function loadFavorites(gallery: { id: string; accountId: string }) {
  const secret = serverEnv().AUTH_SECRET;
  if (!secret) return EMPTY_STATE;
  const jar = await cookies();
  const visitor = await resolveVisitor(
    { db: db(), secret },
    gallery,
    jar.get(visitorCookieName(gallery.id))?.value,
  );
  return loadFavoriteState({ db: db() }, gallery, visitor?.id ?? null);
}

async function load(params: Promise<{ slug: string }>) {
  await connection();
  const { slug } = await params;
  const jar = await cookies();
  return loadPublicGallery(
    {
      db: db(),
      storage: getStorage(),
      video: getVideoProvider(),
      accessSecret: serverEnv().AUTH_SECRET,
      accessToken: (id) => jar.get(accessCookieName(id))?.value,
    },
    slug,
  );
}

async function GalleryContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; zip?: string }>;
}) {
  const gallery = await load(params);
  if (!gallery) notFound();
  const t = await getTranslations("PublicGallery");
  if (gallery.locked) {
    const { error } = await searchParams;
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          {gallery.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t("passwordIntro")}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.has(`passwordError.${error}`)
              ? t(`passwordError.${error}`)
              : t("passwordError.invalid")}
          </p>
        )}
        <form action={unlockGalleryAction} className="space-y-3">
          <input type="hidden" name="slug" value={gallery.slug} />
          <label className="block space-y-1 text-sm">
            <span>{t("passwordLabel")}</span>
            <Input
              name="password"
              type="password"
              required
              maxLength={200}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          <Button type="submit">{t("passwordSubmit")}</Button>
        </form>
      </main>
    );
  }
  const { zip } = await searchParams;
  const favorites = await loadFavorites(gallery);
  await recordEvent(db(), gallery, "view");
  let photoNo = 0;
  let videoNo = 0;
  const tiles = gallery.items.map((item) =>
    item.kind === "video"
      ? {
          id: item.id,
          aspect:
            item.width && item.height ? item.width / item.height : undefined,
          video: {
            title: t("videoTitle", { n: ++videoNo }),
            playUrl: item.playUrl,
            hlsUrl: item.hlsUrl,
            posterUrl: item.posterUrl,
            durationS: item.durationS,
          },
        }
      : {
          id: item.id,
          aspect:
            item.width && item.height ? item.width / item.height : undefined,
          src: item.src,
          srcSet: item.srcSet,
          alt: t("photoAlt", { n: ++photoNo }),
          downloads: item.downloads,
        },
  );
  const hasPhotos = photoNo > 0;
  // original first: it is what the couple usually wants
  const photos = gallery.items.filter((i) => i.kind === "photo");
  const zipSizes = (["original", "web"] as const).filter((size) =>
    photos.some((p) => p.downloads[size]),
  );
  return (
    <FavoritesProvider slug={gallery.slug} initial={favorites}>
      <main className="flex-1">
        <GalleryView
          config={gallery.config}
          title={gallery.title}
          logoUrl={gallery.logoUrl ?? undefined}
          coverUrl={gallery.coverUrl ?? undefined}
          coverSrcSet={gallery.coverSrcSet ?? undefined}
          tiles={tiles}
        />
        <div className="mx-auto w-full max-w-xl px-6 pt-10">
          <ShareLinkButton path={`/g/${encodeURIComponent(gallery.slug)}`} />
        </div>
        {hasPhotos && <FavoritesPanel />}
        {zipSizes.length > 0 && (
          <ZipDownload slug={gallery.slug} sizes={zipSizes} result={zip} />
        )}
      </main>
    </FavoritesProvider>
  );
}

export default function PublicGalleryPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; zip?: string }>;
}) {
  return (
    <Suspense>
      <GalleryContent {...props} />
    </Suspense>
  );
}
