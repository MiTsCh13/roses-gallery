import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";

import type { Storage } from "@/lib/storage/types";

export const BACKUP_RETENTION_DAYS = 30;

const day = (d: Date) => d.toISOString().slice(0, 10);

export function backupKey(date: Date) {
  return `backups/db-${day(date)}.sql.gz`;
}

/** Plain-SQL dump of the whole database via `pg_dump` (must be installed). */
export function pgDump(databaseUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pg_dump",
      ["--no-owner", "--no-privileges", "--dbname", databaseUrl],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => (err += c));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(new Error(`pg_dump exited with ${code}: ${err.trim()}`)),
    );
  });
}

/**
 * Daily backup (NFR): uploads `backups/db-<date>.sql.gz` and deletes the one
 * that just fell out of the retention window. The key is derived from the
 * date, so no listing is needed and re-runs on the same day overwrite.
 */
export async function runDbBackup(
  {
    storage,
    databaseUrl,
    dump = pgDump,
  }: {
    storage: Storage;
    databaseUrl: string;
    dump?: (databaseUrl: string) => Promise<Buffer>;
  },
  now: Date = new Date(),
) {
  const sql = await dump(databaseUrl);
  if (sql.length === 0) throw new Error("pg_dump produced an empty dump");
  const body = gzipSync(sql);
  const key = backupKey(now);
  await storage.put(key, body, "application/gzip");
  const expired = new Date(now.getTime() - BACKUP_RETENTION_DAYS * 86_400_000);
  await storage.delete(backupKey(expired));
  return { key, bytes: body.length };
}
