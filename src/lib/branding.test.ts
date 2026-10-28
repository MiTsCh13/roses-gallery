import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { FakeStorage } from "./storage/fake";
import { BrandingError, logoUrl, removeLogo, setLogo } from "./branding";

const { db, close } = createTestDb();
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("data"),
]);
let storage: FakeStorage;
let a: { db: typeof db; storage: FakeStorage; accountId: string };
let b: typeof a;

beforeEach(async () => {
  await resetDb(db);
  storage = new FakeStorage(
    mkdtempSync(path.join(os.tmpdir(), "roses-branding-")),
    "secret",
  );
  const [x, y] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  a = { db, storage, accountId: x.id };
  b = { db, storage, accountId: y.id };
});
afterAll(() => close());

describe("logo", () => {
  it("has no url before upload and a signed one afterwards", async () => {
    expect(await logoUrl(a)).toBeNull();
    await setLogo(a, PNG);
    const url = await logoUrl(a);
    expect(url).toBeTruthy();
    expect(await logoUrl(b)).toBeNull();
  });

  it("replaces the old file", async () => {
    await setLogo(a, PNG);
    const [first] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, a.accountId));
    const oldKey = first.branding.logoKey as string;
    await setLogo(a, PNG);
    expect(await storage.head(oldKey)).toBeNull();
  });

  it("stores under the account prefix and removes on request", async () => {
    await setLogo(a, PNG);
    const rows = await db.select().from(accounts);
    const key = rows.find((r) => r.id === a.accountId)!.branding
      .logoKey as string;
    expect(key.startsWith(`${a.accountId}/`)).toBe(true);
    await removeLogo(a);
    expect(await storage.head(key)).toBeNull();
    expect(await logoUrl(a)).toBeNull();
  });

  it("rejects wrong formats by content and oversized files", async () => {
    await expect(
      setLogo(a, Buffer.from("<svg onload=alert(1)></svg>")),
    ).rejects.toMatchObject({ code: "logo_invalid" });
    await expect(
      setLogo(a, Buffer.concat([PNG, Buffer.alloc(2_000_000)])),
    ).rejects.toBeInstanceOf(BrandingError);
  });
});
