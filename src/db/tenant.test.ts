import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb } from "@/test/db";
import { accounts } from "./schema";
import { tenantDb } from "./tenant";

const { db, close } = createTestDb();

let a: string;
let b: string;

beforeEach(async () => {
  await resetDb(db);
  [{ id: a }, { id: b }] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
});
afterAll(() => close());

describe("tenantDb", () => {
  it("lets a creator not read another account's galleries", async () => {
    const other = await tenantDb(db, b).galleries.create({
      slug: "x",
      title: "Fremd",
    });
    const mine = tenantDb(db, a);

    expect(await mine.galleries.list()).toEqual([]);
    expect(await mine.galleries.get(other.id)).toBeUndefined();
  });

  it("does not update or delete foreign rows", async () => {
    const other = await tenantDb(db, b).galleries.create({
      slug: "x",
      title: "Fremd",
    });
    const mine = tenantDb(db, a);

    expect(
      await mine.galleries.update(other.id, { title: "Hack" }),
    ).toBeUndefined();
    expect(await mine.galleries.remove(other.id)).toBe(false);
    expect((await tenantDb(db, b).galleries.get(other.id))?.title).toBe(
      "Fremd",
    );
  });

  it("forces the accountId on insert and ignores it on update", async () => {
    const mine = tenantDb(db, a);
    const g = await mine.galleries.create({
      slug: "y",
      title: "Meins",
      accountId: b,
    } as never);
    expect(g.accountId).toBe(a);

    const updated = await mine.galleries.update(g.id, {
      accountId: b,
      title: "Neu",
    } as never);
    expect(updated?.accountId).toBe(a);
    expect(updated?.title).toBe("Neu");
  });

  it("rejects an empty accountId", () => {
    expect(() => tenantDb(db, "")).toThrow();
  });
});
