import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { GalleryView } from "@/components/gallery/gallery-view";
import { db } from "@/db";
import { loadPublicGallery } from "@/lib/public-gallery";
import { getStorage } from "@/lib/storage";

// Never index client galleries.
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function load(params: Promise<{ slug: string }>) {
  await connection();
  const { slug } = await params;
  return loadPublicGallery({ db: db(), storage: getStorage() }, slug);
}

async function GalleryContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const gallery = await load(params);
  if (!gallery) notFound();
  return (
    <main className="flex-1">
      <GalleryView
        config={gallery.config}
        title={gallery.title}
        logoUrl={gallery.logoUrl ?? undefined}
        sets={gallery.sets.map((s) => ({
          id: s.id,
          title: s.title,
          tiles: [],
        }))}
      />
    </main>
  );
}

export default function PublicGalleryPage(props: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense>
      <GalleryContent {...props} />
    </Suspense>
  );
}
