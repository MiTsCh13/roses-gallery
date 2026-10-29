import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { FakeStorage } from "@/lib/storage/fake";
import type { Storage } from "@/lib/storage/types";
import { testDatabaseUrl } from "@/test/db-url";
import { backupKey, pgDump, runDbBackup } from "./db-backup";

const storage = (): Storage =>
  new FakeStorage(mkdtempSync(path.join(os.tmpdir(), "roses-bk-")), "secret");

describe("runDbBackup", () => {
  it("stores the gzipped dump under the date key", async () => {
    const s = storage();
    const now = new Date("2026-10-29T02:30:00Z");
    const result = await runDbBackup(
      {
        storage: s,
        databaseUrl: "x",
        dump: async () => Buffer.from("SELECT 1;"),
      },
      now,
    );
    expect(result.key).toBe("backups/db-2026-10-29.sql.gz");
    expect(gunzipSync(await s.get(result.key)).toString()).toBe("SELECT 1;");
  });

  it("drops the backup that left the 30-day window and keeps the rest", async () => {
    const s = storage();
    const now = new Date("2026-10-29T02:30:00Z");
    for (const d of ["2026-09-29", "2026-09-30", "2026-10-28"]) {
      await s.put(
        backupKey(new Date(d)),
        Buffer.from("old"),
        "application/gzip",
      );
    }
    await runDbBackup(
      { storage: s, databaseUrl: "x", dump: async () => Buffer.from("x") },
      now,
    );
    expect(await s.head(backupKey(new Date("2026-09-29")))).toBeNull();
    expect(await s.head(backupKey(new Date("2026-09-30")))).not.toBeNull();
    expect(await s.head(backupKey(new Date("2026-10-28")))).not.toBeNull();
  });

  it("fails on an empty dump instead of storing it", async () => {
    const s = storage();
    await expect(
      runDbBackup({
        storage: s,
        databaseUrl: "x",
        dump: async () => Buffer.alloc(0),
      }),
    ).rejects.toThrow(/empty/);
  });
});

describe("pgDump", () => {
  it("dumps the real test database", async () => {
    const sql = (await pgDump(testDatabaseUrl())).toString();
    expect(sql).toContain("CREATE TABLE public.accounts");
  });

  it("rejects when the database is unreachable", async () => {
    await expect(
      pgDump("postgres://nobody:x@127.0.0.1:1/none"),
    ).rejects.toThrow(/pg_dump exited/);
  });
});
