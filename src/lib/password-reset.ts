import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { authSessions, passwordResetTokens, users } from "@/db/schema";
import { accountPasswordSchema } from "@/lib/account-password";
import { hashPassword } from "@/lib/gallery-access";
import type { Mailer } from "@/lib/mailer";

// "Passwort vergessen" (D-157): a one-time link by e-mail, valid 15 minutes.
// Only the SHA-256 of the token is stored. Using it sets the new password,
// signs the user out everywhere and sends a notice mail.

export const RESET_TTL_MS = 15 * 60 * 1000;

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "invalid token");

export class PasswordResetError extends Error {
  constructor(public code: "invalid_token") {
    super(code);
  }
}

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

type MailDeps = { db: Db; mailer: Mailer; baseUrl: string; now?: Date };

/**
 * Sends a reset link if the e-mail belongs to a user. Unknown addresses get
 * no mail and the same (void) result, so accounts cannot be probed.
 */
export async function requestPasswordReset(deps: MailDeps, email: string) {
  const address = z.email().max(254).parse(email);
  const [user] = await deps.db
    .select({ id: users.id, accountId: users.accountId, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${address.toLowerCase()}`)
    .limit(1);
  if (!user) return;

  const now = deps.now ?? new Date();
  const token = randomBytes(32).toString("base64url");
  await deps.db.insert(passwordResetTokens).values({
    accountId: user.accountId,
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + RESET_TTL_MS),
  });
  const link = `${deps.baseUrl.replace(/\/$/, "")}/login/reset/${token}`;
  await deps.mailer.send({
    to: user.email,
    subject: "Passwort zurücksetzen – Roses Gallery",
    text: [
      "Hallo,",
      "",
      "über diesen Link kannst du ein neues Passwort für Roses Gallery festlegen. Er ist 15 Minuten gültig und funktioniert nur einmal:",
      "",
      link,
      "",
      "Du hast das nicht angefordert? Dann ignoriere diese E-Mail – dein Passwort bleibt unverändert.",
    ].join("\n"),
  });
}

/** True if the token is unused and not expired (for rendering the form). */
export async function isResetTokenValid(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<boolean> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return false;
  const [row] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(parsed.data)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Consumes the token, sets the new password and ends all sessions of the
 * user. The new password is validated before the token is spent.
 */
export async function resetPassword(
  deps: { db: Db; mailer: Mailer; now?: Date },
  input: { token: string; password: string },
) {
  const password = accountPasswordSchema.parse(input.password);
  const parsed = tokenSchema.safeParse(input.token);
  if (!parsed.success) throw new PasswordResetError("invalid_token");
  const now = deps.now ?? new Date();

  const user = await deps.db.transaction(async (tx) => {
    // Conditional update = the token can be spent exactly once.
    const [spent] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashToken(parsed.data)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({
        userId: passwordResetTokens.userId,
        accountId: passwordResetTokens.accountId,
      });
    if (!spent) throw new PasswordResetError("invalid_token");

    const [row] = await tx
      .update(users)
      .set({ passwordHash: hashPassword(password) })
      .where(
        and(eq(users.id, spent.userId), eq(users.accountId, spent.accountId)),
      )
      .returning({ id: users.id, email: users.email });
    if (!row) throw new PasswordResetError("invalid_token");

    // Other open links of the user become useless as well.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, row.id),
          eq(passwordResetTokens.accountId, spent.accountId),
          isNull(passwordResetTokens.usedAt),
        ),
      );
    // Signed out everywhere: a hijacked session does not survive the reset.
    await tx.delete(authSessions).where(eq(authSessions.userId, row.id));
    return row;
  });

  await deps.mailer.send({
    to: user.email,
    subject: "Dein Passwort wurde geändert – Roses Gallery",
    text: [
      "Hallo,",
      "",
      "das Passwort deines Roses-Gallery-Kontos wurde soeben über „Passwort vergessen“ neu festgelegt. Alle Geräte wurden abgemeldet.",
      "",
      "Warst du das nicht? Fordere sofort einen neuen Link über „Passwort vergessen“ an, lege ein neues Passwort fest und prüfe die Zwei-Faktor-Anmeldung in den Einstellungen.",
    ].join("\n"),
  });
}
