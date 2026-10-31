import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, media, sets } from "@/db/schema";
import { createTestDb, resetDb, linkSetMedia } from "@/test/db";
import { FakeStorage } from "@/lib/storage/fake";
import { allows, effectivePolicy } from "./download-policy";
import { resolvePhotoDownload, setSetDownloadPolicy } from "./downloads";
import { createAccessToken, hashPassword } from "./gallery-access";
import { loadPublicGallery } from "./public-gallery";

const { db, close } = createTestDb();
const storage = new FakeStorage(
  mkdtempSync(path.join(os.tmpdir(), "roses-dl-")),
  "secret",
);
const SECRET = "test-secret-with-enough-length";
let accountId: string;
let otherId: string;

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
      ...galleryValues,
    })
    .returning();
  const [set] = await db
    .insert(sets)
    .values({
      accountId,
      galleryId: g.id,
      title: "Trauung",
      downloadPolicy: setPolicy,
    })
    .returning();
  const [photo] = await db
    .insert(media)
    .values({
      accountId,
      setId: set.id,
      type: "photo",
      processingStatus: "ready",
      originalKey: `${accountId}/m/original-1`,
      variants: {
        "400": {
          key: `${accountId}/m/r1-400.webp`,
          width: 400,
          height: 300,
          size: 1,
        },
        "2400": {
          key: `${accountId}/m/r1-2400.webp`,
          width: 2400,
          height: 1800,
          size: 1,
        },
      },
    })
    .returning();
  await linkSetMedia(db);
  return { g, set, photo };
}

beforeEach(async () => {
  await resetDb(db);
  const [a, b] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  accountId = a.id;
  otherId = b.id;
});
afterAll(close);

describe("policy helpers", () => {
  it("lets the set override the gallery", () => {
    expect(effectivePolicy("web", null)).toBe("web");
    expect(effectivePolicy("web", "none")).toBe("none");
    expect(effectivePolicy("none", "original")).toBe("original");
  });
  it("orders none < web < original", () => {
    expect(allows("none", "web")).toBe(false);
    expect(allows("web", "web")).toBe(true);
    expect(allows("web", "original")).toBe(false);
    expect(allows("original", "web")).toBe(true);
    expect(allows("original", "original")).toBe(true);
  });
});

describe("resolvePhotoDownload", () => {
  const ask = (
    slug: string,
    mediaId: string,
    size: "web" | "original",
    extra: Partial<Parameters<typeof resolvePhotoDownload>[0]> = {},
  ) => resolvePhotoDownload({ db, storage, ...extra }, { slug, mediaId, size });

  it("serves the web size by default and refuses the original", async () => {
    const { photo } = await setup();
    const web = await ask("anna-ben", photo.id, "web");
    expect(web.ok && web.url).toContain("r1-2400.webp");
    expect(web.ok && web.url).toContain("anna-ben-1.webp");
    expect(await ask("anna-ben", photo.id, "original")).toEqual({
      ok: false,
      reason: "forbidden",
    });
  });

  it("serves the original when the gallery allows it", async () => {
    const { photo } = await setup({ downloadPolicy: "original" });
    const r = await ask("anna-ben", photo.id, "original");
    expect(r.ok && r.url).toContain("original-1");
    expect(r.ok && r.url).toContain("anna-ben-1-original");
  });

  it("refuses everything when downloads are off", async () => {
    const off = await setup({ downloadPolicy: "none" });
    expect(await ask("anna-ben", off.photo.id, "web")).toMatchObject({
      reason: "forbidden",
    });
  });

  it("hides drafts, expired galleries, unknown media and other galleries' media", async () => {
    const { photo, g } = await setup();
    expect(await ask("nope", photo.id, "web")).toMatchObject({
      reason: "not_found",
    });
    expect(await ask("anna-ben", "not-a-uuid", "web")).toMatchObject({
      reason: "not_found",
    });
    expect(await ask("anna-ben", crypto.randomUUID(), "web")).toMatchObject({
      reason: "not_found",
    });
    await db.update(galleries).set({ expiresAt: new Date("2030-01-01") });
    expect(
      await resolvePhotoDownload(
        { db, storage, now: new Date("2999-01-01") },
        { slug: "anna-ben", mediaId: photo.id, size: "web" },
      ),
    ).toMatchObject({ reason: "not_found" });
    await db.update(galleries).set({ expiresAt: null, status: "draft" });
    expect(await ask("anna-ben", photo.id, "web")).toMatchObject({
      reason: "not_found",
    });
    void g;
    // media of a second gallery is not reachable through the first slug
    await db.update(galleries).set({ status: "published" });
    const [g2] = await db
      .insert(galleries)
      .values({ accountId, slug: "zwei", title: "Zwei", status: "published" })
      .returning();
    expect(await ask("zwei", photo.id, "web")).toMatchObject({
      reason: "not_found",
    });
    void g2;
  });

  it("requires the password cookie for protected galleries", async () => {
    const { photo, g } = await setup({
      passwordHash: hashPassword("geheim-1"),
    });
    expect(await ask("anna-ben", photo.id, "web")).toMatchObject({
      reason: "not_found",
    });
    const [row] = await db.select().from(galleries);
    const token = createAccessToken(SECRET, {
      id: g.id,
      passwordHash: row.passwordHash!,
    });
    const r = await ask("anna-ben", photo.id, "web", {
      accessSecret: SECRET,
      accessToken: () => token,
    });
    expect(r.ok).toBe(true);
  });

  it("refuses photos that are not processed yet", async () => {
    const { photo } = await setup();
    await db.update(media).set({ processingStatus: "pending" });
    expect(await ask("anna-ben", photo.id, "web")).toMatchObject({
      reason: "not_found",
    });
  });
});

describe("setSetDownloadPolicy", () => {
  it("sets, inherits and stays tenant-scoped", async () => {
    const { set } = await setup();
    await setSetDownloadPolicy({ db, accountId }, set.id, "original");
    expect((await db.select().from(sets))[0].downloadPolicy).toBe("original");
    await setSetDownloadPolicy({ db, accountId }, set.id, "inherit");
    expect((await db.select().from(sets))[0].downloadPolicy).toBeNull();
    await expect(
      setSetDownloadPolicy({ db, accountId: otherId }, set.id, "none"),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      setSetDownloadPolicy({ db, accountId }, set.id, "bogus"),
    ).rejects.toThrow();
  });
});

describe("loadPublicGallery download links", () => {
  it("only lists links the gallery policy permits", async () => {
    const { photo } = await setup({ downloadPolicy: "web" });
    const r = await loadPublicGallery({ db, storage }, "anna-ben");
    const p = r && !r.locked ? r.items[0] : undefined;
    expect(p?.kind === "photo" ? p.downloads : undefined).toEqual({
      web: `/api/g/anna-ben/download/${photo.id}?size=web`,
    });
    await db.update(galleries).set({ downloadPolicy: "original" });
    const r2 = await loadPublicGallery({ db, storage }, "anna-ben");
    expect(
      r2 && !r2.locked && r2.items[0].kind === "photo"
        ? r2.items[0].downloads.original
        : undefined,
    ).toContain("size=original");
    await db.update(galleries).set({ downloadPolicy: "none" });
    const r3 = await loadPublicGallery({ db, storage }, "anna-ben");
    expect(
      r3 && !r3.locked && r3.items[0].kind === "photo"
        ? r3.items[0].downloads
        : undefined,
    ).toEqual({});
  });
});
