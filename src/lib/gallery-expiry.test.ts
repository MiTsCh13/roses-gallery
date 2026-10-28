import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries, users, visitors } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { createTestDb, resetDb } from "@/test/db";
import { runGalleryExpiry } from "./gallery-expiry";
import { updateGallery } from "./galleries";
import { FakeMailer } from "./mailer";

const { db, close } = createTestDb();
const now = new Date("2026-10-28T07:00:00Z");
const day = 24 * 60 * 60 * 1000;
let accountId: string;
let otherId: string;
let mailer: FakeMailer;

beforeEach(async () => {
  await resetDb(db);
  mailer = new FakeMailer();
  [{ id: accountId }, { id: otherId }] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  await db.insert(users).values([
    { accountId, email: "owner@a.de", role: "owner" },
    { accountId: otherId, email: "owner@b.de", role: "owner" },
  ]);
});
afterAll(() => close());

async function gallery(
  id: string,
  slug: string,
  expiresInDays: number | null,
  status: "draft" | "published" = "published",
) {
  return tenantDb(db, id).galleries.create({
    slug,
    title: slug,
    status,
    expiresAt:
      expiresInDays === null
        ? null
        : new Date(now.getTime() + expiresInDays * day),
  });
}

describe("runGalleryExpiry", () => {
  it("expires only published galleries past their date", async () => {
    const past = await gallery(accountId, "past", -1);
    const future = await gallery(accountId, "future", 30);
    const none = await gallery(accountId, "none", null);
    const draft = await gallery(accountId, "draft", -1, "draft");

    const result = await runGalleryExpiry({ db, mailer }, now);
    expect(result.expired).toBe(1);

    const t = tenantDb(db, accountId);
    expect((await t.galleries.get(past.id))?.status).toBe("expired");
    expect((await t.galleries.get(future.id))?.status).toBe("published");
    expect((await t.galleries.get(none.id))?.status).toBe("published");
    expect((await t.galleries.get(draft.id))?.status).toBe("draft");
  });

  it("sends one reminder to clients and owners, only within 7 days", async () => {
    const soon = await gallery(accountId, "soon", 5);
    await gallery(accountId, "later", 20);
    await db.insert(visitors).values([
      { accountId, galleryId: soon.id, email: "Kunde@x.de", role: "client" },
      { accountId, galleryId: soon.id, email: "gast@x.de", role: "guest" },
    ]);

    expect(await runGalleryExpiry({ db, mailer }, now)).toMatchObject({
      reminded: 1,
    });
    expect(mailer.outbox.map((m) => m.to).sort()).toEqual([
      "kunde@x.de",
      "owner@a.de",
    ]);
    expect(mailer.outbox[0].subject).toContain("soon");

    // Second run: nothing new.
    await runGalleryExpiry({ db, mailer }, now);
    expect(mailer.outbox).toHaveLength(2);
  });

  it("does not mix up accounts", async () => {
    await gallery(otherId, "fremd", 3);
    await runGalleryExpiry({ db, mailer }, now);
    expect(mailer.outbox.map((m) => m.to)).toEqual(["owner@b.de"]);
  });

  it("retries after a failed send", async () => {
    const g = await gallery(accountId, "soon", 2);
    const failing = {
      send: async () => {
        throw new Error("smtp down");
      },
    };
    expect(await runGalleryExpiry({ db, mailer: failing }, now)).toMatchObject({
      reminded: 0,
    });
    expect(await runGalleryExpiry({ db, mailer }, now)).toMatchObject({
      reminded: 1,
    });
    const [row] = await db.select().from(galleries);
    expect(row.id).toBe(g.id);
    expect(row.expiryReminderSentAt).not.toBeNull();
  });

  it("re-arms the reminder when the expiry date moves", async () => {
    const g = await gallery(accountId, "soon", 2);
    await runGalleryExpiry({ db, mailer }, now);
    await updateGallery(
      { db, accountId },
      {
        galleryId: g.id,
        title: "soon",
        status: "published",
        expiresAt: new Date(now.getTime() + 3 * day).toISOString(),
      },
    );
    await runGalleryExpiry({ db, mailer }, now);
    expect(mailer.outbox.filter((m) => m.to === "owner@a.de")).toHaveLength(2);
  });
});
