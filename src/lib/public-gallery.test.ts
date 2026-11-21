import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, galleryMedia, media, themes } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { FakeStorage } from "@/lib/storage/fake";
import { FakeVideoProvider } from "@/lib/video/fake";
import { SYSTEM_THEMES } from "@/lib/themes";
import { createAccessToken, hashPassword } from "./gallery-access";
import { loadPublicGallery } from "./public-gallery";

const { db, close } = createTestDb();
const storage = new FakeStorage(
  mkdtempSync(path.join(os.tmpdir(), "roses-public-")),
  "secret",
);
let accountId: string;
let otherId: string;

async function gallery(values: Partial<typeof galleries.$inferInsert> = {}) {
  const [g] = await db
    .insert(galleries)
    .values({
      accountId,
      slug: "anna-ben",
      title: "Anna & Ben",
      status: "published",
      ...values,
    })
    .returning();
  return g;
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

// puts media into the gallery in the given order
async function link(galleryId: string, ids: string[]) {
  await db.insert(galleryMedia).values(
    ids.map((mediaId, position) => ({
      accountId,
      galleryId,
      mediaId,
      position,
    })),
  );
}

// unprotected galleries: narrows away the password gate
async function loadOpen(
  deps: Parameters<typeof loadPublicGallery>[0],
  slug: string,
) {
  const r = await loadPublicGallery(deps, slug);
  if (r?.locked) throw new Error("gallery unexpectedly locked");
  return r;
}

describe("loadPublicGallery", () => {
  it("returns a published gallery with default theme", async () => {
    await gallery();
    const r = await loadOpen({ db, storage }, "anna-ben");
    expect(r?.title).toBe("Anna & Ben");
    expect(r?.items).toEqual([]);
    expect(r?.config).toEqual(SYSTEM_THEMES[0].config);
    expect(r?.logoUrl).toBeNull();
  });

  it("hides drafts, archived, expired and unknown galleries", async () => {
    await gallery({ slug: "draft", status: "draft" });
    await gallery({ slug: "archived", status: "archived" });
    await gallery({ slug: "expired", status: "expired" });
    await gallery({ slug: "past", expiresAt: new Date(Date.now() - 1000) });
    await gallery({ slug: "future", expiresAt: new Date(Date.now() + 1e6) });
    for (const slug of ["draft", "archived", "expired", "past", "nope"])
      expect(await loadPublicGallery({ db, storage }, slug)).toBeNull();
    expect(await loadPublicGallery({ db, storage }, "future")).not.toBeNull();
  });

  it("applies the system theme and ignores another account's theme", async () => {
    const dark = SYSTEM_THEMES.find((t) => t.name === "Dunkel")!;
    await gallery({ slug: "dark", themeId: dark.id });
    const [foreign] = await db
      .insert(themes)
      .values({
        accountId: otherId,
        name: "Fremd",
        config: { ...dark.config, cover: { style: "split" } },
      })
      .returning();
    await gallery({ slug: "foreign", themeId: foreign.id });
    expect((await loadOpen({ db, storage }, "dark"))?.config).toEqual(
      dark.config,
    );
    expect((await loadOpen({ db, storage }, "foreign"))?.config).toEqual(
      SYSTEM_THEMES[0].config,
    );
  });

  it("signs the account logo", async () => {
    await storage.put(`${accountId}/branding/logo.png`, Buffer.from("x"));
    await db
      .update(accounts)
      .set({ branding: { logoKey: `${accountId}/branding/logo.png` } })
      .where(eq(accounts.id, accountId));
    await gallery();
    const r = await loadOpen({ db, storage }, "anna-ben");
    expect(r?.logoUrl).toContain("logo.png");
  });

  it("lists ready photos in gallery order with signed srcset and the cover", async () => {
    const g = await gallery();
    const variants = (id: string) => ({
      "400": {
        key: `${accountId}/d/${id}-400.webp`,
        width: 400,
        height: 300,
        size: 1,
      },
      "1200": {
        key: `${accountId}/d/${id}-1200.webp`,
        width: 1200,
        height: 900,
        size: 1,
      },
      "2400": {
        key: `${accountId}/d/${id}-2400.webp`,
        width: 2400,
        height: 1800,
        size: 1,
      },
    });
    const base = { accountId, type: "photo" as const };
    const [second, first, pending, failed] = await db
      .insert(media)
      .values([
        {
          ...base,
          position: 1,
          processingStatus: "ready",
          variants: variants("b"),
        },
        {
          ...base,
          position: 0,
          processingStatus: "ready",
          variants: variants("a"),
        },
        { ...base, position: 2, processingStatus: "pending" },
        { ...base, position: 3, processingStatus: "failed" },
      ])
      .returning();
    // gallery order, not the media's own position, decides
    await link(g.id, [first.id, pending.id, second.id, failed.id]);
    await db.update(galleries).set({ coverMediaId: second.id });
    const r = await loadOpen({ db, storage }, "anna-ben");
    const photos = r!.items.flatMap((i) => (i.kind === "photo" ? [i] : []));
    expect(photos.map((p) => p.id)).toEqual([first.id, second.id]);
    expect(photos[0].srcSet.split(", ")).toHaveLength(3);
    expect(photos[0].srcSet).toMatch(/400w.*1200w.*2400w/);
    expect(photos[0].src).toContain("-1200.webp");
    expect(r!.coverUrl).toContain("b-2400.webp");
    expect(r!.coverSrcSet).toContain("b-400.webp");
    expect(r!.coverSrcSet).toContain("2400w");
  });

  it("does not leak another account's media into the gallery", async () => {
    const g = await gallery();
    const [foreign] = await db
      .insert(media)
      .values({
        accountId: otherId,
        type: "photo",
        processingStatus: "ready",
        variants: {
          "400": { key: "x/400.webp", width: 400, height: 300, size: 1 },
        },
      })
      .returning();
    // even a stray link row must not expose another tenant's media
    await db.insert(galleryMedia).values({
      accountId,
      galleryId: g.id,
      mediaId: foreign.id,
    });
    const r = await loadOpen({ db, storage }, "anna-ben");
    expect(r!.items).toEqual([]);
  });

  it("mixes ready photos and videos in gallery order, videos with signed play URLs", async () => {
    const video = new FakeVideoProvider();
    const g = await gallery();
    const [photo, ready, pending] = await db
      .insert(media)
      .values([
        {
          accountId,
          type: "photo",
          processingStatus: "ready",
          variants: {
            "400": { key: "x/400.webp", width: 400, height: 300, size: 1 },
          },
        },
        {
          accountId,
          type: "video",
          bunnyVideoId: "v-ready",
          processingStatus: "ready",
          durationS: 90,
        },
        {
          accountId,
          type: "video",
          bunnyVideoId: "v-pending",
          processingStatus: "processing",
        },
      ])
      .returning();
    await link(g.id, [ready.id, photo.id, pending.id]);
    const r = await loadOpen({ db, storage, video }, "anna-ben");
    expect(r?.items.map((i) => [i.kind, i.id])).toEqual([
      ["video", ready.id],
      ["photo", photo.id],
    ]);
    const v = r!.items[0];
    if (v.kind !== "video") throw new Error("expected video");
    expect(v.durationS).toBe(90);
    expect(v.playUrl).toContain("/api/test/player/v-ready?");
    expect(v.hlsUrl).toBeUndefined();
    expect(v.posterUrl).toBeUndefined();
    // a provider with posters exposes the signed URL
    class PosterVideo extends FakeVideoProvider {
      signThumbnailUrl(id = "") {
        return `https://cdn.test/${id}/thumbnail.jpg?token=t`;
      }
    }
    const withPoster = await loadOpen(
      { db, storage, video: new PosterVideo() },
      "anna-ben",
    );
    const pv = withPoster!.items[0];
    expect(pv.kind === "video" && pv.posterUrl).toBe(
      "https://cdn.test/v-ready/thumbnail.jpg?token=t",
    );
    // without a provider no video is exposed
    const none = await loadOpen({ db, storage }, "anna-ben");
    expect(none?.items.map((i) => i.kind)).toEqual(["photo"]);
  });
});

describe("loadPublicGallery description", () => {
  it("exposes the info text under the title", async () => {
    await gallery({ description: "Hochzeit am See" });
    const r = await loadOpen({ db, storage }, "anna-ben");
    expect(r?.description).toBe("Hochzeit am See");
  });
});

describe("loadPublicGallery with a password", () => {
  const SECRET = "test-secret-with-enough-length";

  it("shows only title and slug until the access cookie is present", async () => {
    const g = await gallery({ passwordHash: hashPassword("geheim-1") });
    const locked = await loadPublicGallery(
      { db, storage, accessSecret: SECRET },
      "anna-ben",
    );
    expect(locked).toEqual({
      locked: true,
      slug: "anna-ben",
      title: "Anna & Ben",
    });
    // no secret configured → stays locked, never open
    expect(
      await loadPublicGallery(
        { db, storage, accessToken: () => "x" },
        "anna-ben",
      ),
    ).toMatchObject({ locked: true });

    const token = createAccessToken(SECRET, {
      id: g.id,
      passwordHash: g.passwordHash!,
    });
    const open = await loadPublicGallery(
      { db, storage, accessSecret: SECRET, accessToken: () => token },
      "anna-ben",
    );
    expect(open).toMatchObject({ locked: false });
    expect(open && !open.locked && open.items).toEqual([]);
  });

  it("locks again once the password changed", async () => {
    const g = await gallery({ passwordHash: hashPassword("geheim-1") });
    const token = createAccessToken(SECRET, {
      id: g.id,
      passwordHash: g.passwordHash!,
    });
    await db
      .update(galleries)
      .set({ passwordHash: hashPassword("geheim-2") })
      .where(eq(galleries.id, g.id));
    expect(
      await loadPublicGallery(
        { db, storage, accessSecret: SECRET, accessToken: () => token },
        "anna-ben",
      ),
    ).toMatchObject({ locked: true });
  });
});
