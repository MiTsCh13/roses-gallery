import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { accounts, deliveryMails, visitors } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import type { Mailer } from "@/lib/mailer";

// Delivery mail (F-DASH-03): the creator sends the finished gallery link to
// their clients, in their own words. Placeholders are plain text, no markup.

export const MAX_RECIPIENTS = 20;

export const DEFAULT_SUBJECT = "Deine Galerie „{titel}“ ist fertig";
export const DEFAULT_BODY = `Hallo,

deine Galerie „{titel}“ ist fertig und wartet auf dich:

{link}

{passwort_hinweis}

Viele Grüße
{fotograf}`;

export const PASSWORD_HINT =
  "Die Galerie ist passwortgeschützt. Das Passwort teilt dir {fotograf} separat mit.";

export class DeliveryError extends Error {
  constructor(
    readonly code: "invalid" | "not_found" | "not_published" | "no_recipients",
    message: string,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

const input = z.object({
  galleryId: z.uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  recipients: z.string().max(2000),
});

export function parseRecipients(raw: string): string[] {
  const emails = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails)];
}

export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  // One pass, so a value containing "{titel}" is never expanded again.
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in values ? values[key] : m,
  );
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** HTML twin of the text mail: escaped text, the link made clickable. */
export function renderHtml(
  text: string,
  link: string,
  creator: string,
): string {
  const body = escapeHtml(text)
    .replace(escapeHtml(link), (l) => `<a href="${l}">${l}</a>`)
    .replace(/\n/g, "<br>");
  return `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#222"><p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#888;margin:0 0 16px">${escapeHtml(creator)}</p><p style="font-size:16px;line-height:1.6;margin:0">${body}</p></div>`;
}

type Deps = { db: Db; mailer: Mailer; baseUrl: string; accountId: string };

export type DeliveryResult = { sent: number; failed: number };

export async function sendDeliveryMail(
  { db, mailer, baseUrl, accountId }: Deps,
  raw: unknown,
): Promise<DeliveryResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) throw new DeliveryError("invalid", "Invalid input");
  const { galleryId, subject, body } = parsed.data;

  const recipients = parseRecipients(parsed.data.recipients);
  if (recipients.length === 0)
    throw new DeliveryError("no_recipients", "No recipients");
  if (
    recipients.length > MAX_RECIPIENTS ||
    !recipients.every((e) => z.email().safeParse(e).success)
  )
    throw new DeliveryError("invalid", "Invalid recipients");

  const tenant = tenantDb(db, accountId);
  const gallery = await tenant.galleries.get(galleryId);
  if (!gallery) throw new DeliveryError("not_found", "Gallery not found");
  if (gallery.status !== "published")
    throw new DeliveryError("not_published", "Gallery is not published");
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId));

  const link = `${baseUrl.replace(/\/$/, "")}/g/${gallery.slug}`;
  const values: Record<string, string> = {
    titel: gallery.title,
    link,
    fotograf: account.name,
  };
  values.passwort_hinweis = gallery.passwordHash
    ? fillTemplate(PASSWORD_HINT, values)
    : "";

  const finalSubject = fillTemplate(subject, values).replace(/\s+/g, " ");
  // An empty placeholder line must not leave a gap of blank lines behind.
  const text = fillTemplate(body, values)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const html = renderHtml(text, link, account.name);

  const known = new Set(
    (
      await db
        .select({ email: visitors.email })
        .from(visitors)
        .where(
          and(
            eq(visitors.accountId, accountId),
            eq(visitors.galleryId, gallery.id),
          ),
        )
    ).map((v) => v.email?.toLowerCase()),
  );

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    let status: "sent" | "failed" = "sent";
    try {
      await mailer.send({ to, subject: finalSubject, text, html });
      sent++;
    } catch (error) {
      console.error("delivery mail failed", error);
      status = "failed";
      failed++;
    }
    await tenant.deliveryMails.create({
      galleryId: gallery.id,
      recipient: to,
      subject: finalSubject,
      status,
    });
    // Recipients become the gallery's clients, so they get the expiry reminder.
    if (status === "sent" && !known.has(to)) {
      await tenant.visitors.create({
        galleryId: gallery.id,
        email: to,
        role: "client",
      });
    }
  }
  return { sent, failed };
}

/** Latest delivery log entries of one gallery. */
export async function listDeliveries(
  db: Db,
  accountId: string,
  galleryId: string,
  limit = 20,
) {
  return db
    .select()
    .from(deliveryMails)
    .where(
      and(
        eq(deliveryMails.accountId, accountId),
        eq(deliveryMails.galleryId, galleryId),
      ),
    )
    .orderBy(desc(deliveryMails.createdAt))
    .limit(limit);
}
