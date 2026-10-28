import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { GalleryView } from "@/components/gallery/gallery-view";
import { db } from "@/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { serverEnv } from "@/lib/env";
import { loadPublicGallery } from "@/lib/public-gallery";
import { getStorage } from "@/lib/storage";
import { getVideoProvider } from "@/lib/video";
import { accessCookieName } from "@/lib/gallery-access";
import { unlockGalleryAction } from "./actions";

// Never index client galleries.
export const metadata: Metadata = { robots: { index: false, follow: false } };

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
  searchParams: Promise<{ error?: string }>;
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
  return (
    <main className="flex-1">
      <GalleryView
        config={gallery.config}
        title={gallery.title}
        logoUrl={gallery.logoUrl ?? undefined}
        coverUrl={gallery.coverUrl ?? undefined}
        coverSrcSet={gallery.coverSrcSet ?? undefined}
        sets={gallery.sets.map((s) => ({
          id: s.id,
          title: s.title,
          videos: s.videos.map((v, n) => ({
            id: v.id,
            title: t("videoTitle", { n: n + 1 }),
            playUrl: v.playUrl,
            hlsUrl: v.hlsUrl,
            durationS: v.durationS,
          })),
          tiles: s.photos.map((p, n) => ({
            id: p.id,
            src: p.src,
            srcSet: p.srcSet,
            alt: t("photoAlt", { n: n + 1 }),
          })),
        }))}
      />
    </main>
  );
}

export default function PublicGalleryPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense>
      <GalleryContent {...props} />
    </Suspense>
  );
}
