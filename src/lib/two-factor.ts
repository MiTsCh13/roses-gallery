import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { base32Encode, generateTotpSecret, verifyTotp } from "./totp";

// Optionale Zwei-Faktor-Anmeldung für Creator (TOTP, D-131).

export const RECOVERY_CODE_COUNT = 8;

function keyFrom(authSecret: string) {
  return createHash("sha256").update(`2fa:${authSecret}`).digest();
}

export function encryptSecret(plain: string, authSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(authSecret), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc]
    .map((b) => b.toString("base64url"))
    .join(".");
}

export function decryptSecret(stored: string, authSecret: string): string {
  const [iv, tag, enc] = stored
    .split(".")
    .map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(authSecret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

function normalizeRecovery(code: string) {
  return code.toLowerCase().replace(/[\s-]/g, "");
}

function hashRecovery(code: string) {
  return createHash("sha256").update(normalizeRecovery(code)).digest("hex");
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = base32Encode(randomBytes(6)).toLowerCase().slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** True when the signed-in session still has to pass the second factor. */
export function secondFactorPending(
  totpEnabledAt: Date | null,
  secondFactorAt: Date | null,
) {
  return totpEnabledAt !== null && secondFactorAt === null;
}

async function loadUser(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}

/** Creates (or replaces) a not-yet-active secret and returns it for the authenticator app. */
export async function startTwoFactorSetup(
  db: Db,
  authSecret: string,
  userId: string,
): Promise<{ secret: string } | { error: "already_enabled" }> {
  const user = await loadUser(db, userId);
  if (!user) throw new Error("User not found");
  if (user.totpEnabledAt) return { error: "already_enabled" };
  const secret = generateTotpSecret();
  await db
    .update(users)
    .set({ totpSecret: encryptSecret(secret, authSecret), totpLastStep: null })
    .where(eq(users.id, userId));
  return { secret };
}

/** The pending secret again, e.g. after a page reload during setup. */
export async function pendingSetupSecret(
  db: Db,
  authSecret: string,
  userId: string,
): Promise<string | null> {
  const user = await loadUser(db, userId);
  if (!user?.totpSecret || user.totpEnabledAt) return null;
  return decryptSecret(user.totpSecret, authSecret);
}

/** Activates 2FA when the code matches; returns the one-time recovery codes. */
export async function confirmTwoFactorSetup(
  db: Db,
  authSecret: string,
  userId: string,
  code: string,
  now = Date.now(),
): Promise<{ recoveryCodes: string[] } | null> {
  const user = await loadUser(db, userId);
  if (!user?.totpSecret || user.totpEnabledAt) return null;
  const step = verifyTotp(
    decryptSecret(user.totpSecret, authSecret),
    code,
    now,
  );
  if (step === null) return null;
  const recoveryCodes = generateRecoveryCodes();
  const updated = await db
    .update(users)
    .set({
      totpEnabledAt: new Date(now),
      totpLastStep: step,
      totpRecoveryHashes: recoveryCodes.map(hashRecovery),
    })
    .where(and(eq(users.id, userId), isNull(users.totpEnabledAt)))
    .returning({ id: users.id });
  return updated.length ? { recoveryCodes } : null;
}

/** Marks the session that just enabled 2FA as verified so it is not locked out. */
export async function markSessionVerified(
  db: Db,
  sessionToken: string,
  userId: string,
  now = Date.now(),
) {
  await db
    .update(authSessions)
    .set({ secondFactorAt: new Date(now) })
    .where(
      and(
        eq(authSessions.sessionToken, sessionToken),
        eq(authSessions.userId, userId),
      ),
    );
}

/** Consumes a TOTP step (no replay) or a recovery code. */
async function consumeSecondFactor(
  db: Db,
  authSecret: string,
  userId: string,
  code: string,
  now: number,
): Promise<boolean> {
  const user = await loadUser(db, userId);
  if (!user?.totpSecret || !user.totpEnabledAt) return false;
  const step = verifyTotp(
    decryptSecret(user.totpSecret, authSecret),
    code,
    now,
  );
  if (step !== null) {
    const claimed = await db
      .update(users)
      .set({ totpLastStep: step })
      .where(
        and(
          eq(users.id, userId),
          or(isNull(users.totpLastStep), lt(users.totpLastStep, step)),
        ),
      )
      .returning({ id: users.id });
    return claimed.length > 0;
  }
  const hash = hashRecovery(code);
  const used = await db
    .update(users)
    .set({
      totpRecoveryHashes: sql`array_remove(${users.totpRecoveryHashes}, ${hash})`,
    })
    .where(
      and(
        eq(users.id, userId),
        sql`${hash} = any(${users.totpRecoveryHashes})`,
      ),
    )
    .returning({ id: users.id });
  return used.length > 0;
}

/** Second factor at sign-in: on success the session is marked as verified. */
export async function completeSecondFactor(
  db: Db,
  authSecret: string,
  input: { sessionToken: string; userId: string; code: string; now?: number },
): Promise<boolean> {
  const now = input.now ?? Date.now();
  const [session] = await db
    .select({ userId: authSessions.userId })
    .from(authSessions)
    .where(eq(authSessions.sessionToken, input.sessionToken));
  if (!session || session.userId !== input.userId) return false;
  if (
    !(await consumeSecondFactor(db, authSecret, input.userId, input.code, now))
  )
    return false;
  await db
    .update(authSessions)
    .set({ secondFactorAt: new Date(now) })
    .where(eq(authSessions.sessionToken, input.sessionToken));
  return true;
}

/** Turns 2FA off after re-checking a valid code. */
export async function disableTwoFactor(
  db: Db,
  authSecret: string,
  userId: string,
  code: string,
  now = Date.now(),
): Promise<boolean> {
  if (!(await consumeSecondFactor(db, authSecret, userId, code, now)))
    return false;
  await db
    .update(users)
    .set({
      totpSecret: null,
      totpEnabledAt: null,
      totpLastStep: null,
      totpRecoveryHashes: null,
    })
    .where(eq(users.id, userId));
  return true;
}

export async function recoveryCodesLeft(db: Db, userId: string) {
  const user = await loadUser(db, userId);
  return user?.totpRecoveryHashes?.length ?? 0;
}
