import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  accounts,
  authSessions,
  passwordResetTokens,
  users,
} from "@/db/schema";
import { FakeMailer } from "@/lib/mailer";
import { createTestDb, resetDb } from "@/test/db";
import {
  authenticateWithPassword,
  createPasswordSession,
} from "./account-password";
import {
  PasswordResetError,
  RESET_TTL_MS,
  isResetTokenValid,
  requestPasswordReset,
  resetPassword,
} from "./password-reset";

const { db, close } = createTestDb();
let mailer: FakeMailer;
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

const tokenFrom = (text: string) =>
  text.match(/\/login\/reset\/([A-Za-z0-9_-]+)/)![1];

beforeEach(async () => {
  await resetDb(db);
  mailer = new FakeMailer();
  a = await seed("Studio A", "a@example.de");
  b = await seed("Studio B", "b@example.de");
});
afterAll(() => close());

const deps = () => ({ db, mailer, baseUrl: "https://roses-gallery.app/" });

describe("password reset", () => {
  it("mails a one-time link and stores only a hash", async () => {
    await requestPasswordReset(deps(), "A@Example.de");
    const mail = mailer.lastTo("a@example.de")!;
    expect(mail.text).toContain("https://roses-gallery.app/login/reset/");
    const token = tokenFrom(mail.text);
    const rows = await db.select().from(passwordResetTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(a.userId);
    expect(rows[0].accountId).toBe(a.accountId);
    expect(rows[0].tokenHash).not.toContain(token);
    expect(await isResetTokenValid(db, token)).toBe(true);
  });

  it("sends nothing for unknown addresses", async () => {
    await requestPasswordReset(deps(), "nobody@example.de");
    expect(mailer.outbox).toHaveLength(0);
    expect(await db.select().from(passwordResetTokens)).toHaveLength(0);
  });

  it("sets the password, ends all sessions, notifies and works once", async () => {
    await createPasswordSession(db, a.userId);
    await createPasswordSession(db, b.userId);
    await requestPasswordReset(deps(), "a@example.de");
    const token = tokenFrom(mailer.lastTo("a@example.de")!.text);

    await resetPassword({ db, mailer }, { token, password: "neues-geheim1" });
    expect(
      await authenticateWithPassword(db, "a@example.de", "neues-geheim1"),
    ).toEqual({ id: a.userId, accountId: a.accountId });
    expect(
      await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.userId, a.userId)),
    ).toHaveLength(0);
    // Other tenants are untouched.
    expect(
      await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.userId, b.userId)),
    ).toHaveLength(1);
    expect(mailer.lastTo("a@example.de")!.subject).toContain("geändert");

    await expect(
      resetPassword({ db, mailer }, { token, password: "noch-ein-pw1" }),
    ).rejects.toBeInstanceOf(PasswordResetError);
    expect(await isResetTokenValid(db, token)).toBe(false);
  });

  it("invalidates the other open links of the user", async () => {
    await requestPasswordReset(deps(), "a@example.de");
    const first = tokenFrom(mailer.lastTo("a@example.de")!.text);
    await requestPasswordReset(deps(), "a@example.de");
    const second = tokenFrom(mailer.lastTo("a@example.de")!.text);
    await resetPassword(
      { db, mailer },
      { token: second, password: "neues-geheim1" },
    );
    expect(await isResetTokenValid(db, first)).toBe(false);
  });

  it("rejects expired links", async () => {
    const past = new Date(Date.now() - RESET_TTL_MS - 1000);
    await requestPasswordReset({ ...deps(), now: past }, "a@example.de");
    const token = tokenFrom(mailer.lastTo("a@example.de")!.text);
    expect(await isResetTokenValid(db, token)).toBe(false);
    await expect(
      resetPassword({ db, mailer }, { token, password: "neues-geheim1" }),
    ).rejects.toBeInstanceOf(PasswordResetError);
  });

  it("validates the password before spending the token", async () => {
    await requestPasswordReset(deps(), "a@example.de");
    const token = tokenFrom(mailer.lastTo("a@example.de")!.text);
    await expect(
      resetPassword({ db, mailer }, { token, password: "kurz" }),
    ).rejects.toThrow();
    expect(await isResetTokenValid(db, token)).toBe(true);
  });

  it("rejects malformed tokens", async () => {
    expect(await isResetTokenValid(db, "../../etc")).toBe(false);
    await expect(
      resetPassword({ db, mailer }, { token: "x", password: "neues-geheim1" }),
    ).rejects.toBeInstanceOf(PasswordResetError);
  });
});
