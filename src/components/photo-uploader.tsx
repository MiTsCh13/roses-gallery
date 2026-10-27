"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import {
  browserTransport,
  UploadClientError,
  uploadPhoto,
  type UploadErrorCode,
} from "@/lib/upload-client";

type Item = {
  id: number;
  name: string;
  size: number;
  loaded: number;
  state: "queued" | "uploading" | "done" | "error";
  error?: UploadErrorCode;
  abort: AbortController;
};

const CONCURRENCY = 3;

export function PhotoUploader({ setId }: { setId: string }) {
  const t = useTranslations("Upload");
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const patch = (id: number, change: Partial<Item>) =>
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...change } : i)));

  async function run(files: File[]) {
    const added: { item: Item; file: File }[] = files.map((file) => ({
      file,
      item: {
        id: nextId.current++,
        name: file.name,
        size: file.size,
        loaded: 0,
        state: "queued",
        abort: new AbortController(),
      },
    }));
    setItems((all) => [...all, ...added.map((a) => a.item)]);

    const queue = [...added];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const { item, file } = next;
        if (item.abort.signal.aborted) continue;
        patch(item.id, { state: "uploading" });
        try {
          await uploadPhoto(file, browserTransport, {
            setId,
            signal: item.abort.signal,
            onProgress: (loaded) => patch(item.id, { loaded }),
          });
          patch(item.id, { state: "done", loaded: item.size });
          router.refresh();
        } catch (error) {
          patch(item.id, {
            state: "error",
            error: error instanceof UploadClientError ? error.code : "failed",
          });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  const pick = (list: FileList | null) => {
    if (list?.length) void run(Array.from(list));
    if (input.current) input.current.value = "";
  };

  return (
    <section aria-labelledby="upload-title" className="space-y-4">
      <h2 id="upload-title" className="text-lg font-medium">
        {t("title")}
      </h2>
      <div
        data-testid="dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center ${dragging ? "border-foreground bg-muted" : "border-border"}`}
      >
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <Button type="button" onClick={() => input.current?.click()}>
          {t("choose")}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/tiff"
          className="sr-only"
          aria-label={t("choose")}
          data-testid="file-input"
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-2" data-testid="upload-list">
          {items.map((item) => (
            <li
              key={item.id}
              data-state={item.state}
              className="space-y-1 rounded-md border p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{item.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {item.state === "error"
                    ? t(`error.${item.error}`)
                    : item.state === "done"
                      ? t("done")
                      : `${formatBytes(item.loaded)} / ${formatBytes(item.size)}`}
                </span>
              </div>
              {(item.state === "queued" || item.state === "uploading") && (
                <div className="flex items-center gap-3">
                  <progress
                    className="h-2 flex-1"
                    max={item.size}
                    value={item.loaded}
                    aria-label={item.name}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => item.abort.abort()}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
