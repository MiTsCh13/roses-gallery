import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/gallery-access";

// Optional password login for creators (D-141). The hash is scrypt (same format
// as gallery passwords, D-122); Magic Link and Google keep working.

export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

export const accountPasswordSchema = z.string().min(8).max(200);

export class PasswordError extends Error {
  constructor(public code: "wrong_current" | "not_found") {
    super(code);
  }
}

// Verified against when the e-mail is unknown, so timing does not reveal accounts.
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

export async function hasPassword(
  db: Db,
  accountId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ hash: users.passwordHash })
    .from(users)
    .where(and(eq(users.accountId, accountId), eq(users.id, userId)))
    .limit(1);
  return !!row?.hash;
}

/** Sets or changes the password; changing an existing one needs the current one. */
export async function setAccountPassword(
  db: Db,
  accountId: string,
  userId: string,
  input: { current?: string; next: string },
) {
  const next = accountPasswordSchema.parse(input.next);
  const [row] = await db
    .select({ hash: users.passwordHash })
    .from(users)
    .where(and(eq(users.accountId, accountId), eq(users.id, userId)))
    .limit(1);
  if (!row) throw new PasswordError("not_found");
  if (row.hash && !verifyPassword(input.current ?? "", row.hash)) {
    throw new PasswordError("wrong_current");
  }
  await db
    .update(users)
    .set({ passwordHash: hashPassword(next) })
    .where(and(eq(users.accountId, accountId), eq(users.id, userId)));
}

/** Returns the user for a correct e-mail/password pair, otherwise null. */
export async function authenticateWithPassword(
  db: Db,
  email: string,
  password: string,
): Promise<{ id: string; accountId: string } | null> {
  const [row] = await db
    .select({
      id: users.id,
      accountId: users.accountId,
      hash: users.passwordHash,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  const ok = verifyPassword(password, row?.hash ?? DUMMY_HASH);
  if (!row?.hash || !ok) return null;
  return { id: row.id, accountId: row.accountId };
}

/**
 * Creates an Auth.js database session (secondFactorAt stays empty, so 2FA is
 * still required for accounts that enabled it).
 */
export async function createPasswordSession(db: Db, userId: string) {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_S * 1000);
  await db.insert(authSessions).values({ sessionToken, userId, expires });
  return { sessionToken, expires };
}
