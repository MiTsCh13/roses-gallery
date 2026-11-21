import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, authSessions, users } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import {
  PasswordError,
  authenticateWithPassword,
  createPasswordSession,
  hasPassword,
  setAccountPassword,
} from "./account-password";

const { db, close } = createTestDb();
let a: { accountId: string; userId: string };
let b: { accountId: string; userId: string };

async function seed(name: string, email: string) {
  const [acc] = await db.insert(accounts).values({ name }).returning();
  const [user] = await db
    .insert(users)
    .values({ accountId: acc.id, email })
    .returning();
  return { accountId: acc.id, userId: user.id };
}

beforeEach(async () => {
  await resetDb(db);
  a = await seed("Studio A", "a@example.de");
  b = await seed("Studio B", "b@example.de");
});
afterAll(() => close());

describe("account password", () => {
  it("sets a first password without a current one and logs in", async () => {
    expect(await hasPassword(db, a.accountId, a.userId)).toBe(false);
    await setAccountPassword(db, a.accountId, a.userId, { next: "geheim1234" });
    expect(await hasPassword(db, a.accountId, a.userId)).toBe(true);
    const ok = await authenticateWithPassword(db, "A@Example.de", "geheim1234");
    expect(ok).toEqual({ id: a.userId, accountId: a.accountId });
    expect(
      await authenticateWithPassword(db, "a@example.de", "falsch1234"),
    ).toBeNull();
    expect(
      await authenticateWithPassword(db, "niemand@example.de", "geheim1234"),
    ).toBeNull();
  });

  it("never logs in accounts without a password", async () => {
    expect(await authenticateWithPassword(db, "a@example.de", "")).toBeNull();
  });

  it("needs the current password to change it", async () => {
    await setAccountPassword(db, a.accountId, a.userId, { next: "geheim1234" });
    await expect(
      setAccountPassword(db, a.accountId, a.userId, {
        current: "falsch1234",
        next: "neuesPasswort1",
      }),
    ).rejects.toThrow(PasswordError);
    await setAccountPassword(db, a.accountId, a.userId, {
      current: "geheim1234",
      next: "neuesPasswort1",
    });
    expect(
      await authenticateWithPassword(db, "a@example.de", "neuesPasswort1"),
    ).not.toBeNull();
    expect(
      await authenticateWithPassword(db, "a@example.de", "geheim1234"),
    ).toBeNull();
  });

  it("rejects too short passwords", async () => {
    await expect(
      setAccountPassword(db, a.accountId, a.userId, { next: "kurz" }),
    ).rejects.toThrow();
  });

  it("cannot touch a user of another account", async () => {
    await expect(
      setAccountPassword(db, a.accountId, b.userId, { next: "geheim1234" }),
    ).rejects.toThrow(PasswordError);
    expect(await hasPassword(db, b.accountId, b.userId)).toBe(false);
  });

  it("creates a session without second factor", async () => {
    const { sessionToken, expires } = await createPasswordSession(db, a.userId);
    const [row] = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.sessionToken, sessionToken));
    expect(row.userId).toBe(a.userId);
    expect(row.secondFactorAt).toBeNull();
    expect(expires.getTime()).toBeGreaterThan(Date.now());
  });
});
