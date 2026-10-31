"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  addGalleryMediaAction,
  removeGalleryMediaAction,
} from "@/app/dashboard/galleries/actions";
import { Button } from "@/components/ui/button";

type Item = { id: string; type: "photo" | "video" };

function Grid({
  items,
  selected,
  onToggle,
  testId,
  label,
}: {
  items: Item[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  testId: string;
  label: string;
}) {
  const t = useTranslations("GalleryEditor");
  return (
    <ul
      data-testid={testId}
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5"
    >
      {items.map((m, i) => (
        <li key={m.id}>
          <label className="relative block aspect-square cursor-pointer overflow-hidden rounded-md bg-muted">
            {m.type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/library/thumb/${m.id}`}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-2xl">
                ▶<span className="sr-only">{t("video")}</span>
              </span>
            )}
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => onToggle(m.id)}
              aria-label={t("select", { label, n: i + 1 })}
              className="absolute top-1.5 left-1.5 size-4"
            />
          </label>
        </li>
      ))}
    </ul>
  );
}

export function GalleryMediaPanel({
  galleryId,
  inGallery,
  addable,
}: {
  galleryId: string;
  inGallery: Item[];
  addable: Item[];
}) {
  const t = useTranslations("GalleryEditor");
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const toggle =
    (set: Set<string>, update: (s: Set<string>) => void) => (id: string) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      update(next);
    };

  return (
    <section aria-labelledby="media-title" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="media-title" className="mr-auto text-lg font-medium">
          {t("mediaTitle", { count: inGallery.length })}
        </h2>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPicking((p) => !p)}
          aria-expanded={picking}
        >
          {t("addFromLibrary")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={marked.size === 0 || pending}
          onClick={() =>
            start(async () => {
              await removeGalleryMediaAction(galleryId, [...marked]);
              setMarked(new Set());
            })
          }
        >
          {t("removeSelected", { count: marked.size })}
        </Button>
      </div>

      {picking && (
        <div className="space-y-3 rounded-lg border p-3" data-testid="picker">
          {addable.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pickerEmpty")}</p>
          ) : (
            <>
              <Grid
                items={addable}
                selected={chosen}
                onToggle={toggle(chosen, setChosen)}
                testId="picker-grid"
                label={t("library")}
              />
              <Button
                type="button"
                disabled={chosen.size === 0 || pending}
                onClick={() =>
                  start(async () => {
                    await addGalleryMediaAction(galleryId, [...chosen]);
                    setChosen(new Set());
                    setPicking(false);
                  })
                }
              >
                {t("addSelected", { count: chosen.size })}
              </Button>
            </>
          )}
        </div>
      )}

      {inGallery.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("mediaEmpty")}</p>
      ) : (
        <Grid
          items={inGallery}
          selected={marked}
          onToggle={toggle(marked, setMarked)}
          testId="gallery-media"
          label={t("gallery")}
        />
      )}
    </section>
  );
}
