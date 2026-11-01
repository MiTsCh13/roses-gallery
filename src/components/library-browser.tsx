"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  createFolderAction,
  deleteFolderAction,
  deleteMediaAction,
  moveMediaAction,
  renameFolderAction,
} from "@/app/dashboard/library/actions";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import {
  browserTransport,
  UploadClientError,
  uploadPhoto,
  type UploadErrorCode,
} from "@/lib/upload-client";
import { uploadVideoFile } from "@/lib/video-upload-client";

type Folder = { id: string; name: string };
type Item = {
  id: string;
  type: "photo" | "video";
  status: "pending" | "processing" | "ready" | "failed";
  sizeBytes: number;
};
type Job = {
  id: number;
  file: File;
  loaded: number;
  state: "uploading" | "done" | "error";
  error?: UploadErrorCode | "plan_limit" | "failed";
  abort: AbortController;
  stopTus?: () => void;
};

const CONCURRENCY = 3;

export function LibraryBrowser({
  folderId,
  path,
  folders,
  allFolders,
  media,
}: {
  folderId: string | null;
  path: Folder[];
  folders: Folder[];
  allFolders: Folder[];
  media: Item[];
}) {
  const t = useTranslations("Library");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const patch = (id: number, change: Partial<Job>) =>
    setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...change } : j)));

  const mutate = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await fn();
        setError(false);
        setSelected(new Set());
        router.refresh();
      } catch {
        setError(true);
      }
    });

  async function runJob(job: Job) {
    patch(job.id, { state: "uploading", error: undefined, loaded: 0 });
    try {
      if (job.file.type.startsWith("video/"))
        await uploadVideoFile(job.file, {
          folderId: folderId ?? undefined,
          onProgress: (loaded) => patch(job.id, { loaded }),
          onStop: (stopTus) => patch(job.id, { stopTus }),
        });
      else
        await uploadPhoto(job.file, browserTransport, {
          folderId: folderId ?? undefined,
          signal: job.abort.signal,
          onProgress: (loaded) => patch(job.id, { loaded }),
        });
      patch(job.id, {
        state: "done",
        loaded: job.file.size,
        stopTus: undefined,
      });
      router.refresh();
    } catch (e) {
      patch(job.id, {
        state: "error",
        stopTus: undefined,
        error:
          e instanceof UploadClientError
            ? e.code
            : e instanceof Error && e.message === "storage_exceeded"
              ? "plan_limit"
              : "failed",
      });
    }
  }

  async function run(files: File[]) {
    const added: Job[] = files.map((file) => ({
      id: nextId.current++,
      file,
      loaded: 0,
      state: "uploading",
      abort: new AbortController(),
    }));
    setJobs((all) => [...all, ...added]);
    const queue = [...added];
    const worker = async () => {
      for (let j = queue.shift(); j; j = queue.shift()) await runJob(j);
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  const pick = (list: FileList | null) => {
    if (list?.length) void run(Array.from(list));
    if (input.current) input.current.value = "";
  };

  const retry = (job: Job) => {
    const fresh = { ...job, abort: new AbortController() };
    setJobs((all) => all.map((j) => (j.id === job.id ? fresh : j)));
    void runJob(fresh);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const chosen = [...selected];

  return (
    <div className="space-y-6">
      <nav
        aria-label="Pfad"
        className="flex flex-wrap items-center gap-1 text-sm"
      >
        <Link
          href="/dashboard/library"
          className="underline-offset-2 hover:underline"
        >
          {t("root")}
        </Link>
        {path.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <span aria-hidden>/</span>
            <Link
              href={`/dashboard/library?folder=${p.id}`}
              className="underline-offset-2 hover:underline"
            >
              {p.name}
            </Link>
          </span>
        ))}
      </nav>

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
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center ${dragging ? "border-primary bg-accent" : "border-border"}`}
      >
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <Button type="button" onClick={() => input.current?.click()}>
          {t("choose")}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/tiff,video/*"
          className="sr-only"
          aria-label={t("choose")}
          data-testid="file-input"
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      {jobs.length > 0 && (
        <ul className="space-y-2" data-testid="upload-list">
          {jobs.map((job) => (
            <li
              key={job.id}
              data-state={job.state}
              className="space-y-1 rounded-md border p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{job.file.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  {job.state === "error"
                    ? t(`error.${job.error}`)
                    : job.state === "done"
                      ? t("done")
                      : `${formatBytes(job.loaded)} / ${formatBytes(job.file.size)}`}
                  {job.state === "error" &&
                    job.error !== "unsupported_type" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => retry(job)}
                      >
                        {t("retry")}
                      </Button>
                    )}
                </span>
              </div>
              {job.state === "uploading" && (
                <div className="flex items-center gap-3">
                  <progress
                    className="h-2 flex-1"
                    max={job.file.size}
                    value={job.loaded}
                    aria-label={job.file.name}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      job.abort.abort();
                      job.stopTus?.();
                      if (job.stopTus)
                        patch(job.id, { state: "error", error: "aborted" });
                    }}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = name.trim();
          if (!value) return;
          mutate(async () => {
            await createFolderAction(value, folderId);
            setName("");
          });
        }}
      >
        <label className="space-y-1 text-sm">
          <span>{t("folderName")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="block h-9 rounded-md border bg-transparent px-3"
          />
        </label>
        <Button type="submit" variant="outline" disabled={pending}>
          {t("newFolder")}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("actionFailed")}
        </p>
      )}

      {chosen.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3 text-sm"
          data-testid="selection-bar"
        >
          <span>{t("selected", { count: chosen.length })}</span>
          <select
            aria-label={t("moveTo")}
            defaultValue=""
            className="h-9 rounded-md border bg-transparent px-2"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              mutate(() => moveMediaAction(chosen, v === "root" ? null : v));
            }}
          >
            <option value="">{t("moveTo")}</option>
            <option value="root">{t("root")}</option>
            {allFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t("deleteConfirm", { count: chosen.length })))
                mutate(() => deleteMediaAction(chosen));
            }}
          >
            {t("delete")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            {t("clear")}
          </Button>
        </div>
      )}

      {folders.length > 0 && (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          data-testid="folder-list"
        >
          {folders.map((f) => (
            <li
              key={f.id}
              className="space-y-2 rounded-lg border bg-card p-3 text-sm"
            >
              <Link
                href={`/dashboard/library?folder=${f.id}`}
                className="block truncate font-medium"
              >
                📁 {f.name}
              </Link>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = window.prompt(t("renamePrompt"), f.name);
                    if (next?.trim())
                      mutate(() => renameFolderAction(f.id, next));
                  }}
                >
                  {t("rename")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (
                      window.confirm(t("deleteFolderConfirm", { name: f.name }))
                    )
                      mutate(() => deleteFolderAction(f.id));
                  }}
                >
                  {t("deleteFolder")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {media.length === 0 && folders.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
      {media.length > 0 && (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5"
          data-testid="media-grid"
        >
          {media.map((m, i) => (
            <li
              key={m.id}
              data-id={m.id}
              data-status={m.status}
              data-selected={selected.has(m.id)}
              className={`relative overflow-hidden rounded-lg border bg-card ${selected.has(m.id) ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex aspect-square items-center justify-center bg-muted text-3xl">
                {m.type === "photo" && m.status === "ready" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/library/thumb/${m.id}`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span aria-hidden>{m.type === "video" ? "🎬" : "🖼"}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {m.type === "video" ? t("videoN") : t("photoN")} ·{" "}
                  {t(`status.${m.status}`)} · {formatBytes(m.sizeBytes)}
                </span>
              </div>
              <label className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded bg-background/90">
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                  aria-label={t("select", { n: i + 1 })}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
