import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, authSessions, users } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { totpCode } from "./totp";
import {
  completeSecondFactor,
  confirmTwoFactorSetup,
  decryptSecret,
  disableTwoFactor,
  encryptSecret,
  pendingSetupSecret,
  recoveryCodesLeft,
  secondFactorPending,
  startTwoFactorSetup,
} from "./two-factor";

const { db, close } = createTestDb();
const SECRET = "test-auth-secret-0123456789";
const NOW = 1_800_000_000_000;

beforeEach(() => resetDb(db));
afterAll(() => close());

async function seedUser(email = "anna@foto-rose.de") {
  const [account] = await db
    .insert(accounts)
    .values({ name: "Anna" })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ accountId: account.id, email })
    .returning();
  return user;
}

async function seedSession(userId: string, token = "sess-1") {
  await db
    .insert(authSessions)
    .values({ sessionToken: token, userId, expires: new Date(NOW + 1e9) });
  return token;
}

async function enable(userId: string) {
  const started = await startTwoFactorSetup(db as never, SECRET, userId);
  if ("error" in started) throw new Error(started.error);
  const done = await confirmTwoFactorSetup(
    db as never,
    SECRET,
    userId,
    totpCode(started.secret, NOW),
    NOW,
  );
  return { secret: started.secret, recoveryCodes: done!.recoveryCodes };
}

describe("two-factor", () => {
  it("encrypts the secret at rest", () => {
    const stored = encryptSecret("JBSWY3DPEHPK3PXP", SECRET);
    expect(stored).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(stored, SECRET)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptSecret(stored, "other-secret-0123456789")).toThrow();
  });

  it("stays inactive until a valid code confirms the setup", async () => {
    const user = await seedUser();
    const started = await startTwoFactorSetup(db as never, SECRET, user.id);
    if ("error" in started) throw new Error("unexpected");
    expect(await pendingSetupSecret(db as never, SECRET, user.id)).toBe(
      started.secret,
    );
    expect(
      await confirmTwoFactorSetup(db as never, SECRET, user.id, "000000", NOW),
    ).toBeNull();
    const [row] = await db.select().from(users);
    expect(row.totpEnabledAt).toBeNull();
    expect(row.totpSecret).not.toContain(started.secret);

    const { recoveryCodes } = await enable(user.id);
    expect(recoveryCodes).toHaveLength(8);
    const [after] = await db.select().from(users);
    expect(after.totpEnabledAt).not.toBeNull();
    expect(JSON.stringify(after.totpRecoveryHashes)).not.toContain(
      recoveryCodes[0],
    );
  });

  it("refuses a second setup while enabled", async () => {
    const user = await seedUser();
    await enable(user.id);
    expect(await startTwoFactorSetup(db as never, SECRET, user.id)).toEqual({
      error: "already_enabled",
    });
  });

  it("verifies a session with a fresh code and rejects replays", async () => {
    const user = await seedUser();
    const { secret } = await enable(user.id);
    const token = await seedSession(user.id);
    const later = NOW + 60_000;
    const code = totpCode(secret, later);

    expect(
      await completeSecondFactor(db as never, SECRET, {
        sessionToken: token,
        userId: user.id,
        code: "123456",
        now: later,
      }),
    ).toBe(false);
    expect(
      await completeSecondFactor(db as never, SECRET, {
        sessionToken: token,
        userId: user.id,
        code,
        now: later,
      }),
    ).toBe(true);
    const [s] = await db.select().from(authSessions);
    expect(s.secondFactorAt).not.toBeNull();

    const other = await seedSession(user.id, "sess-2");
    expect(
      await completeSecondFactor(db as never, SECRET, {
        sessionToken: other,
        userId: user.id,
        code,
        now: later,
      }),
    ).toBe(false);
  });

  it("does not verify a session that belongs to another user", async () => {
    const anna = await seedUser();
    const ben = await seedUser("ben@foto-rose.de");
    const { secret } = await enable(anna.id);
    const token = await seedSession(ben.id);
    expect(
      await completeSecondFactor(db as never, SECRET, {
        sessionToken: token,
        userId: anna.id,
        code: totpCode(secret, NOW + 60_000),
        now: NOW + 60_000,
      }),
    ).toBe(false);
  });

  it("accepts each recovery code exactly once", async () => {
    const user = await seedUser();
    const { recoveryCodes } = await enable(user.id);
    const a = await seedSession(user.id, "a");
    const b = await seedSession(user.id, "b");
    const input = { userId: user.id, code: recoveryCodes[0].toUpperCase() };
    expect(
      await completeSecondFactor(db as never, SECRET, {
        ...input,
        sessionToken: a,
      }),
    ).toBe(true);
    expect(
      await completeSecondFactor(db as never, SECRET, {
        ...input,
        sessionToken: b,
      }),
    ).toBe(false);
    expect(await recoveryCodesLeft(db as never, user.id)).toBe(7);
  });

  it("disables 2FA only with a valid code", async () => {
    const user = await seedUser();
    const { secret } = await enable(user.id);
    const later = NOW + 60_000;
    expect(
      await disableTwoFactor(db as never, SECRET, user.id, "000000", later),
    ).toBe(false);
    expect(
      await disableTwoFactor(
        db as never,
        SECRET,
        user.id,
        totpCode(secret, later),
        later,
      ),
    ).toBe(true);
    const [row] = await db.select().from(users);
    expect(row.totpEnabledAt).toBeNull();
    expect(row.totpSecret).toBeNull();
  });

  it("flags only enabled users without a verified session as pending", () => {
    expect(secondFactorPending(null, null)).toBe(false);
    expect(secondFactorPending(new Date(), null)).toBe(true);
    expect(secondFactorPending(new Date(), new Date())).toBe(false);
  });
});

describe("markSessionVerified", () => {
  it("only verifies the given user's session", async () => {
    const { markSessionVerified } = await import("./two-factor");
    const anna = await seedUser();
    const ben = await seedUser("ben@foto-rose.de");
    await seedSession(anna.id, "anna-s");
    await markSessionVerified(db as never, "anna-s", ben.id, NOW);
    expect((await db.select().from(authSessions))[0].secondFactorAt).toBeNull();
    await markSessionVerified(db as never, "anna-s", anna.id, NOW);
    expect(
      (await db.select().from(authSessions))[0].secondFactorAt,
    ).not.toBeNull();
  });
});
