"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "tus-js-client";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import type { TusUpload } from "@/lib/video/types";

type Item = {
  id: number;
  name: string;
  size: number;
  loaded: number;
  state: "uploading" | "done" | "error";
  error?: "plan_limit" | "failed";
  abort?: () => void;
};

async function post(action: string, body: unknown) {
  const response = await fetch(`/api/videos/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "failed");
  return data;
}

export function VideoUploader({ setId }: { setId: string }) {
  const t = useTranslations("VideoUpload");
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const patch = (id: number, change: Partial<Item>) =>
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...change } : i)));

  async function upload(file: File) {
    const id = nextId.current++;
    setItems((all) => [
      ...all,
      { id, name: file.name, size: file.size, loaded: 0, state: "uploading" },
    ]);
    try {
      const { mediaId, tus } = (await post("start", {
        setId,
        title: file.name.replace(/\.[^.]+$/, "") || file.name,
        sizeBytes: file.size,
      })) as { mediaId: string; tus: TusUpload };

      await new Promise<void>((resolve, reject) => {
        const tusUpload = new Upload(file, {
          endpoint: tus.endpoint,
          headers: tus.headers,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 64 * 1024 * 1024,
          metadata: { filetype: file.type, title: file.name },
          onProgress: (loaded) => patch(id, { loaded }),
          onError: reject,
          onSuccess: () => resolve(),
        });
        patch(id, { abort: () => void tusUpload.abort(true) });
        tusUpload.start();
      });
      await post("refresh", { mediaId });
      patch(id, { state: "done", loaded: file.size, abort: undefined });
      router.refresh();
    } catch (error) {
      patch(id, {
        state: "error",
        abort: undefined,
        error:
          error instanceof Error && error.message === "storage_exceeded"
            ? "plan_limit"
            : "failed",
      });
    }
  }

  const pick = (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) void upload(file);
    if (input.current) input.current.value = "";
  };

  return (
    <section aria-labelledby="video-upload-title" className="space-y-4">
      <h2 id="video-upload-title" className="text-lg font-medium">
        {t("title")}
      </h2>
      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <Button type="button" onClick={() => input.current?.click()}>
          {t("choose")}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="video/*"
          className="sr-only"
          aria-label={t("choose")}
          data-testid="video-input"
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      {items.length > 0 && (
        <ul className="space-y-2" data-testid="video-upload-list">
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
              {item.state === "uploading" && (
                <div className="flex items-center gap-3">
                  <progress
                    className="h-2 flex-1"
                    max={item.size}
                    value={item.loaded}
                    aria-label={item.name}
                  />
                  {item.abort && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={item.abort}
                    >
                      {t("cancel")}
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
