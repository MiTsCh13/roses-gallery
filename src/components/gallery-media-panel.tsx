"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  addGalleryMediaAction,
  deleteGalleryMediaAction,
  removeGalleryMediaAction,
  reorderGalleryMediaAction,
  setGalleryCoverAction,
} from "@/app/dashboard/galleries/actions";
import { Button } from "@/components/ui/button";
import { browserTransport, uploadPhoto } from "@/lib/upload-client";
import { uploadVideoFile } from "@/lib/video-upload-client";

type Item = { id: string; type: "photo" | "video"; ready?: boolean };

function Grid({
  items,
  selected,
  onToggle,
  testId,
  label,
  coverId,
  onMove,
}: {
  coverId?: string | null;
  onMove?: (fromId: string, toId: string) => void;
  items: Item[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  testId: string;
  label: string;
}) {
  const t = useTranslations("GalleryEditor");
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <ul
      data-testid={testId}
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5"
    >
      {items.map((m, i) => (
        <li
          key={m.id}
          draggable={Boolean(onMove)}
          data-media-id={m.id}
          onDragStart={() => setDragId(m.id)}
          onDragEnd={() => setDragId(null)}
          onDragOver={(e) => onMove && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (onMove && dragId && dragId !== m.id) onMove(dragId, m.id);
            setDragId(null);
          }}
          className={dragId === m.id ? "opacity-50" : undefined}
        >
          <label className="relative block aspect-square cursor-pointer overflow-hidden rounded-md bg-muted">
            {m.type === "photo" && m.ready === false ? (
              <span
                data-testid="media-processing"
                className="flex size-full animate-pulse items-center justify-center p-1 text-center text-xs text-muted-foreground"
              >
                {t("processing")}
              </span>
            ) : m.type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/library/thumb/${m.id}`}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <span className="relative flex size-full items-center justify-center text-2xl">
                {/* poster frame; hidden again if the CDN has none */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/library/thumb/${m.id}`}
                  alt=""
                  loading="lazy"
                  data-testid="video-poster"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                  className="absolute inset-0 size-full object-cover"
                />
                <span className="relative rounded-full bg-black/50 px-2 text-white">
                  ▶
                </span>
                <span className="sr-only">{t("video")}</span>
              </span>
            )}
            {coverId === m.id && (
              <span className="absolute right-1.5 bottom-1.5 rounded bg-background/90 px-1.5 py-0.5 text-xs">
                {t("isCover")}
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
  coverMediaId,
  inGallery: serverItems,
  addable,
}: {
  galleryId: string;
  coverMediaId: string | null;
  inGallery: Item[];
  addable: Item[];
}) {
  const t = useTranslations("GalleryEditor");
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const [uploads, setUploads] = useState<
    {
      id: number;
      name: string;
      state: "uploading" | "done" | "error";
      loaded: number;
      total: number;
    }[]
  >([]);
  const nextUpload = useRef(0);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [inGallery, setInGallery] = useOptimistic(
    serverItems,
    (_: Item[], next: Item[]) => next,
  );

  const persist = (next: Item[]) => {
    start(async () => {
      setInGallery(next);
      await reorderGalleryMediaAction(
        galleryId,
        next.map((m) => m.id),
      );
    });
  };
  // moves `fromId` to the position of `toId`
  const move = (fromId: string, toId: string) => {
    const from = inGallery.findIndex((m) => m.id === fromId);
    const to = inGallery.findIndex((m) => m.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...inGallery];
    next.splice(to, 0, next.splice(from, 1)[0]);
    persist(next);
  };
  const uploadFiles = async (files: File[]) => {
    const jobs = files.map((file) => ({ id: nextUpload.current++, file }));
    const mark = (id: number, state: "uploading" | "done" | "error") =>
      setUploads((all) => all.map((u) => (u.id === id ? { ...u, state } : u)));
    const progress = (id: number, loaded: number) =>
      setUploads((all) => all.map((u) => (u.id === id ? { ...u, loaded } : u)));
    setUploads((all) => [
      ...all,
      ...jobs.map((j) => ({
        id: j.id,
        name: j.file.name,
        state: "uploading" as const,
        loaded: 0,
        total: j.file.size,
      })),
    ]);
    const queue = [...jobs];
    const worker = async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        try {
          const { mediaId } = j.file.type.startsWith("video/")
            ? await uploadVideoFile(j.file, {
                onProgress: (loaded) => progress(j.id, loaded),
              })
            : await uploadPhoto(j.file, browserTransport, {
                signal: new AbortController().signal,
                onProgress: (loaded) => progress(j.id, loaded),
              });
          await addGalleryMediaAction(galleryId, [mediaId]);
          mark(j.id, "done");
          router.refresh();
        } catch {
          mark(j.id, "error");
        }
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
  };
  const pickFiles = (list: FileList | null) => {
    if (list?.length) void uploadFiles(Array.from(list));
    if (fileInput.current) fileInput.current.value = "";
  };
  const single = marked.size === 1 ? [...marked][0] : null;
  const shift = (delta: number) => {
    if (!single) return;
    const i = inGallery.findIndex((m) => m.id === single);
    const target = inGallery[i + delta];
    if (target) move(single, target.id);
  };
  // the cover can be any single marked photo
  const coverCandidate =
    marked.size === 1
      ? inGallery.find((m) => marked.has(m.id) && m.type === "photo")
      : undefined;

  const toggle =
    (set: Set<string>, update: (s: Set<string>) => void) => (id: string) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      update(next);
    };

  return (
    <section
      aria-labelledby="media-title"
      data-testid="media-dropzone"
      className={`space-y-4 rounded-lg ${dropping ? "outline-2 outline-primary outline-dashed" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        setDropping(false);
        pickFiles(e.dataTransfer.files);
      }}
    >
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
          variant="outline"
          onClick={() => fileInput.current?.click()}
        >
          {t("uploadFiles")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/tiff,video/*"
          className="sr-only"
          aria-label={t("uploadFiles")}
          data-testid="gallery-file-input"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!coverCandidate || pending}
          onClick={() =>
            start(async () => {
              if (coverCandidate) {
                await setGalleryCoverAction(galleryId, coverCandidate.id);
              }
              setMarked(new Set());
            })
          }
        >
          {t("makeCover")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!single || pending}
          onClick={() => shift(-1)}
        >
          {t("moveEarlier")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!single || pending}
          onClick={() => shift(1)}
        >
          {t("moveLater")}
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
        <Button
          type="button"
          variant="ghost"
          disabled={marked.size === 0 || pending}
          onClick={() => {
            if (!window.confirm(t("deleteConfirm", { count: marked.size })))
              return;
            start(async () => {
              await deleteGalleryMediaAction(galleryId, [...marked]);
              setMarked(new Set());
            });
          }}
        >
          {t("deleteSelected", { count: marked.size })}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("dropHint")}</p>
      {uploads.length > 0 && (
        <ul className="space-y-1 text-sm" data-testid="gallery-uploads">
          {uploads.map((u) => (
            <li key={u.id} data-state={u.state} className="space-y-1">
              <div className="flex gap-2">
                <span className="truncate">{u.name}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {u.state === "uploading"
                    ? `${Math.min(100, Math.round((u.loaded / Math.max(1, u.total)) * 100))} %`
                    : t(`upload.${u.state}`)}
                </span>
              </div>
              {u.state === "uploading" && (
                <progress
                  className="h-2 w-full"
                  max={u.total}
                  value={u.loaded}
                  aria-label={u.name}
                />
              )}
            </li>
          ))}
        </ul>
      )}

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
          coverId={coverMediaId}
          onMove={move}
        />
      )}
    </section>
  );
}
