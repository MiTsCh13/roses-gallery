import { and, eq, gt, isNull, lte } from "drizzle-orm";

import type { Db } from "@/db";
import { galleries, users, visitors } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import type { Mailer } from "@/lib/mailer";

export const REMINDER_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

type Deps = { db: Db; mailer: Mailer };

/**
 * Daily housekeeping across accounts (each row is changed through its own
 * tenant scope):
 * - published galleries past their expiry date become `expired`
 * - published galleries expiring within 7 days get one reminder mail, sent to
 *   the gallery's clients and the account owners (D-119). A failed send is
 *   retried on the next run because the reminder is only marked afterwards.
 */
export async function runGalleryExpiry(
  { db, mailer }: Deps,
  now: Date = new Date(),
) {
  const expiredRows = await db
    .select()
    .from(galleries)
    .where(
      and(eq(galleries.status, "published"), lte(galleries.expiresAt, now)),
    );
  for (const g of expiredRows) {
    await tenantDb(db, g.accountId).galleries.update(g.id, {
      status: "expired",
    });
  }

  const due = await db
    .select()
    .from(galleries)
    .where(
      and(
        eq(galleries.status, "published"),
        gt(galleries.expiresAt, now),
        lte(galleries.expiresAt, new Date(now.getTime() + REMINDER_LEAD_MS)),
        isNull(galleries.expiryReminderSentAt),
      ),
    );

  let reminded = 0;
  for (const g of due) {
    const [clients, owners] = await Promise.all([
      db
        .select({ email: visitors.email })
        .from(visitors)
        .where(
          and(
            eq(visitors.accountId, g.accountId),
            eq(visitors.galleryId, g.id),
            eq(visitors.role, "client"),
          ),
        ),
      db
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.accountId, g.accountId), eq(users.role, "owner"))),
    ]);
    const recipients = [
      ...new Set(
        [...clients, ...owners]
          .map((r) => r.email?.trim().toLowerCase())
          .filter((e): e is string => Boolean(e)),
      ),
    ];
    if (recipients.length === 0) continue;

    const date = g.expiresAt!.toLocaleDateString("de-DE");
    try {
      for (const to of recipients) {
        await mailer.send({
          to,
          subject: `Deine Galerie „${g.title}“ läuft bald ab`,
          text: `Die Galerie „${g.title}“ läuft am ${date} ab. Danach ist sie nicht mehr erreichbar. Bitte lade bis dahin alle Fotos und Videos herunter, die du behalten möchtest.`,
        });
      }
    } catch {
      continue;
    }
    await tenantDb(db, g.accountId).galleries.update(g.id, {
      expiryReminderSentAt: now,
    });
    reminded++;
  }
  return { expired: expiredRows.length, reminded };
}
