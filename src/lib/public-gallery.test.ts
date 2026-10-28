import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, sets, themes } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { FakeStorage } from "@/lib/storage/fake";
import { SYSTEM_THEMES } from "@/lib/themes";
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

describe("loadPublicGallery", () => {
  it("returns a published gallery with ordered sets and default theme", async () => {
    const g = await gallery();
    await db.insert(sets).values([
      { accountId, galleryId: g.id, title: "Zweites", position: 1 },
      { accountId, galleryId: g.id, title: "Erstes", position: 0 },
    ]);
    const r = await loadPublicGallery({ db, storage }, "anna-ben");
    expect(r?.title).toBe("Anna & Ben");
    expect(r?.sets.map((s) => s.title)).toEqual(["Erstes", "Zweites"]);
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
    expect((await loadPublicGallery({ db, storage }, "dark"))?.config).toEqual(
      dark.config,
    );
    expect(
      (await loadPublicGallery({ db, storage }, "foreign"))?.config,
    ).toEqual(SYSTEM_THEMES[0].config);
  });

  it("signs the account logo", async () => {
    await storage.put(`${accountId}/branding/logo.png`, Buffer.from("x"));
    await db
      .update(accounts)
      .set({ branding: { logoKey: `${accountId}/branding/logo.png` } })
      .where(eq(accounts.id, accountId));
    await gallery();
    const r = await loadPublicGallery({ db, storage }, "anna-ben");
    expect(r?.logoUrl).toContain("logo.png");
  });
});
