import { db } from "@/db";
import { processPhoto } from "@/lib/photos";
import { cleanupStaleUploads } from "@/lib/upload-cleanup";
import { runGalleryExpiry } from "@/lib/gallery-expiry";
import { buildZipExport, cleanupExpiredZips } from "@/lib/zip-exports";
import { cleanupOldEvents } from "@/lib/events";
import { runDbBackup } from "@/lib/db-backup";
import { getMailer } from "@/lib/mailer";
import { getStorage } from "@/lib/storage";
import { serverEnv } from "@/lib/env";
import {
  isJobName,
  parseJobPayload,
  type JobName,
  type JobPayload,
} from "@/lib/queue";

type Handlers = {
  [N in JobName]: (payload: JobPayload<N>) => Promise<unknown>;
};

export const handlers: Handlers = {
  ping: async ({ requestedAt }) => ({ pong: true, requestedAt }),
  "process-photo": async (payload) =>
    processPhoto({ db: db(), storage: getStorage() }, payload),
  "cleanup-stale-uploads": async () =>
    cleanupStaleUploads({ db: db(), storage: getStorage() }),
  "gallery-expiry": async () =>
    runGalleryExpiry({ db: db(), mailer: getMailer() }),
  "build-zip": async (payload) =>
    buildZipExport(
      {
        db: db(),
        storage: getStorage(),
        mailer: getMailer(),
        baseUrl: serverEnv().AUTH_URL ?? "http://localhost:3000",
      },
      payload,
    ),
  "cleanup-zip-exports": async () =>
    cleanupExpiredZips({ db: db(), storage: getStorage() }),
  "cleanup-events": async () => cleanupOldEvents(db()),
  "db-backup": async () =>
    runDbBackup({
      storage: getStorage(),
      databaseUrl: serverEnv().DATABASE_URL,
    }),
};

export async function dispatch(name: string, data: unknown) {
  if (!isJobName(name)) {
    throw new Error(`Unknown job: ${name}`);
  }
  const handler = handlers[name] as (payload: unknown) => Promise<unknown>;
  return handler(parseJobPayload(name, data));
}
