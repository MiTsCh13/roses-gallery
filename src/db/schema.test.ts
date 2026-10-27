import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb } from "@/test/db";
import { accounts, galleries, sets, media, users } from "./schema";

const { db, close } = createTestDb();

beforeEach(() => resetDb(db));
afterAll(() => close());

describe("schema", () => {
  it("stores the Account → Gallery → Set → Media chain and cascades on delete", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ name: "Foto Rose" })
      .returning();
    const [gallery] = await db
      .insert(galleries)
      .values({ accountId: account.id, slug: "anna-ben", title: "Anna & Ben" })
      .returning();
    const [set] = await db
      .insert(sets)
      .values({
        accountId: account.id,
        galleryId: gallery.id,
        title: "Trauung",
      })
      .returning();
    await db
      .insert(media)
      .values({ accountId: account.id, setId: set.id, type: "photo" });

    expect(gallery.status).toBe("draft");
    await db.delete(accounts);
    expect(await db.select().from(media)).toHaveLength(0);
  });

  it("enforces unique gallery slugs per account only", async () => {
    const [a, b] = await db
      .insert(accounts)
      .values([{ name: "A" }, { name: "B" }])
      .returning();
    await db
      .insert(galleries)
      .values({ accountId: a.id, slug: "x", title: "1" });
    await db
      .insert(galleries)
      .values({ accountId: b.id, slug: "x", title: "2" });
    await expect(
      db.insert(galleries).values({ accountId: a.id, slug: "x", title: "3" }),
    ).rejects.toThrow();
  });

  it("treats user e-mail addresses case-insensitively unique", async () => {
    const [a] = await db.insert(accounts).values({ name: "A" }).returning();
    await db.insert(users).values({ accountId: a.id, email: "Foto@Rose.de" });
    await expect(
      db.insert(users).values({ accountId: a.id, email: "foto@rose.de" }),
    ).rejects.toThrow();
  });
});
