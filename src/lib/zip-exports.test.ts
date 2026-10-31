import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, media, sets, zipExports } from "@/db/schema";
import { createTestDb, resetDb, linkSetMedia } from "@/test/db";
import { FakeMailer } from "@/lib/mailer";
import { FakeStorage } from "@/lib/storage/fake";
import {
  buildZipExport,
  cleanupExpiredZips,
  requestZipExport,
  resolveZipDownload,
  ZIP_LINK_TTL_MS,
} from "./zip-exports";

const { db, close } = createTestDb();
const storage = new FakeStorage(
  mkdtempSync(path.join(os.tmpdir(), "roses-zip-")),
  "secret",
);
let accountId: string;
let queued: { accountId: string; exportId: string }[];

const ask = (
  slug: string,
  extra: Partial<Parameters<typeof requestZipExport>[1]> = {},
  deps: Partial<Parameters<typeof requestZipExport>[0]> = {},
) =>
  requestZipExport(
    {
      db,
      enqueue: async (p) => void queued.push(p),
      ...deps,
    },
    { slug, size: "web", email: "Gast@Example.com", ...extra },
  );

async function setup(
  galleryValues: Partial<typeof galleries.$inferInsert> = {},
  setPolicy: "none" | "web" | "original" | null = null,
) {
  const [g] = await db
    .insert(galleries)
    .values({
      accountId,
      slug: "anna-ben",
      title: "Anna & Ben",
      status: "published",
      downloadPolicy: "web",
      ...galleryValues,
    })
    .returning();
  const [set] = await db
    .insert(sets)
    .values({
      accountId,
      galleryId: g.id,
      title: "Trauung / Kirche",
      downloadPolicy: setPolicy,
    })
    .returning();
  const keys: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const [m] = await db
      .insert(media)
      .values({
        accountId,
        setId: set.id,
        type: "photo",
        processingStatus: "ready",
        position: i,
        sizeBytes: 10,
        originalKey: `${accountId}/m${i}/original-1`,
        variants: {
          "2400": {
            key: `${accountId}/m${i}/r1-2400.webp`,
            width: 2400,
            height: 1800,
            size: 6,
          },
        },
      })
      .returning();
    await storage.put(m.originalKey!, Buffer.from(`orig-${i}`));
    await storage.put(
      `${accountId}/m${i}/r1-2400.webp`,
      Buffer.from(`web-${i}`),
    );
    keys.push(m.id);
  }
  await linkSetMedia(db);
  return { g, set, keys };
}

beforeEach(async () => {
  await resetDb(db);
  queued = [];
  const [a] = await db.insert(accounts).values({ name: "A" }).returning();
  accountId = a.id;
});
afterAll(close);

describe("requestZipExport", () => {
  it("stores a normalised request and queues the build", async () => {
    await setup();
    const r = await ask("anna-ben");
    expect(r.ok).toBe(true);
    const [row] = await db.select().from(zipExports);
    expect(row).toMatchObject({
      email: "gast@example.com",
      size: "web",
      status: "pending",
      accountId,
    });
    expect(queued).toEqual([{ accountId, exportId: row.id }]);
  });

  it("refuses unknown, draft and password-locked galleries", async () => {
    expect(await ask("nope")).toEqual({ ok: false, reason: "not_found" });
    await setup({ status: "draft" });
    expect(await ask("anna-ben")).toEqual({ ok: false, reason: "not_found" });
    await resetDb(db);
    const [a] = await db.insert(accounts).values({ name: "A" }).returning();
    accountId = a.id;
    await setup({ passwordHash: "x" });
    expect(await ask("anna-ben")).toEqual({ ok: false, reason: "not_found" });
    expect(queued).toEqual([]);
  });

  it("enforces the download policy for the requested size", async () => {
    await setup({ downloadPolicy: "web" });
    expect(await ask("anna-ben", { size: "original" })).toEqual({
      ok: false,
      reason: "forbidden",
    });
  });

  it("rejects invalid input", async () => {
    await setup();
    await expect(ask("anna-ben", { email: "kaputt" })).rejects.toThrow();
  });

  it("reports an empty gallery", async () => {
    await db
      .insert(galleries)
      .values({ accountId, slug: "leer", title: "Leer", status: "published" });
    expect(await ask("leer")).toEqual({ ok: false, reason: "empty" });
  });
});

describe("buildZipExport", () => {
  const build = async (mailer = new FakeMailer(), now?: Date) => {
    const [row] = await db.select().from(zipExports);
    const result = await buildZipExport(
      { db, storage, mailer, baseUrl: "https://roses.test/", now },
      { accountId: row.accountId, exportId: row.id },
    );
    return { result, row, mailer };
  };

  it("builds a valid archive, stores it privately and mails the link", async () => {
    await setup();
    await ask("anna-ben");
    const { result, row, mailer } = await build();
    expect(result.status).toBe("ready");

    const [done] = await db.select().from(zipExports);
    expect(done.status).toBe("ready");
    expect(done.storageKey).toBe(`${accountId}/zips/${row.id}.zip`);

    const mail = mailer.lastTo("gast@example.com");
    expect(mail?.text).toContain(
      `https://roses.test/api/g/anna-ben/zip/${row.id}`,
    );

    const file = path.join(
      mkdtempSync(path.join(os.tmpdir(), "roses-zipout-")),
      "x.zip",
    );
    writeFileSync(file, await storage.get(done.storageKey!));
    const names = execFileSync("unzip", ["-Z1", file], { encoding: "utf8" });
    expect(names.trim().split("\n")).toEqual([
      "anna-ben-1.webp",
      "anna-ben-2.webp",
    ]);
    expect(
      execFileSync("unzip", ["-p", file, "anna-ben-2.webp"], {
        encoding: "utf8",
      }),
    ).toBe("web-2");
  });

  it("packs originals when requested and allowed", async () => {
    await setup({ downloadPolicy: "original" });
    await ask("anna-ben", { size: "original" });
    const { row } = await build();
    const [done] = await db.select().from(zipExports);
    expect(done.status).toBe("ready");
    expect((await storage.head(done.storageKey!))?.size).toBeGreaterThan(0);
    expect(row.size).toBe("original");
  });

  it("does not rebuild on retry but sends the mail again", async () => {
    await setup();
    await ask("anna-ben");
    await build();
    const second = await build();
    expect(second.mailer.outbox).toHaveLength(1);
    const [done] = await db.select().from(zipExports);
    expect(done.status).toBe("ready");
  });

  it("fails when the policy was tightened after the request", async () => {
    const { g } = await setup();
    await ask("anna-ben");
    await db
      .update(galleries)
      .set({ downloadPolicy: "none" })
      .where(eqId(g.id));
    const { result, mailer } = await build();
    expect(result.status).toBe("failed");
    expect(mailer.outbox).toHaveLength(0);
    expect((await db.select().from(zipExports))[0].status).toBe("failed");
  });
});

import { eq } from "drizzle-orm";
const eqId = (id: string) => eq(galleries.id, id);

describe("resolveZipDownload", () => {
  async function ready() {
    await setup();
    await ask("anna-ben");
    const [row] = await db.select().from(zipExports);
    await buildZipExport(
      {
        db,
        storage,
        mailer: new FakeMailer(),
        baseUrl: "https://roses.test",
      },
      { accountId, exportId: row.id },
    );
    return row.id;
  }

  it("signs a short-lived URL for a finished archive", async () => {
    const id = await ready();
    const r = await resolveZipDownload(
      { db, storage },
      { slug: "anna-ben", exportId: id },
    );
    expect(r.ok && r.url).toContain(`${id}.zip`);
    expect(r.ok && r.url).toContain("anna-ben.zip");
  });

  it("refuses a wrong slug, an expired link, an unpublished gallery and junk ids", async () => {
    const id = await ready();
    const ok = { db, storage };
    expect(
      await resolveZipDownload(ok, { slug: "anders", exportId: id }),
    ).toEqual({ ok: false });
    expect(
      await resolveZipDownload(ok, { slug: "anna-ben", exportId: "x" }),
    ).toEqual({ ok: false });
    expect(
      await resolveZipDownload(
        { ...ok, now: new Date(Date.now() + ZIP_LINK_TTL_MS + 1000) },
        { slug: "anna-ben", exportId: id },
      ),
    ).toEqual({ ok: false });
    await db.update(galleries).set({ status: "archived" });
    expect(
      await resolveZipDownload(ok, { slug: "anna-ben", exportId: id }),
    ).toEqual({ ok: false });
  });

  it("does not serve an archive that is still pending", async () => {
    await setup();
    await ask("anna-ben");
    const [row] = await db.select().from(zipExports);
    expect(
      await resolveZipDownload(
        { db, storage },
        { slug: "anna-ben", exportId: row.id },
      ),
    ).toEqual({ ok: false });
  });
});

describe("cleanupExpiredZips", () => {
  it("removes expired archives from storage and the table", async () => {
    await setup();
    await ask("anna-ben");
    const [row] = await db.select().from(zipExports);
    await buildZipExport(
      {
        db,
        storage,
        mailer: new FakeMailer(),
        baseUrl: "https://roses.test",
      },
      { accountId, exportId: row.id },
    );
    const [ready] = await db.select().from(zipExports);
    const later = new Date(Date.now() + ZIP_LINK_TTL_MS + 1000);
    expect(await cleanupExpiredZips({ db, storage }, new Date())).toEqual({
      removed: 0,
    });
    expect(await cleanupExpiredZips({ db, storage }, later)).toEqual({
      removed: 1,
    });
    expect(await storage.head(ready.storageKey!)).toBeNull();
    expect(await db.select().from(zipExports)).toHaveLength(0);
  });
});
