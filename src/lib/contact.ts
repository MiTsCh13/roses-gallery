import { z } from "zod";

import type { Mailer } from "@/lib/mailer";

// Kontaktformular der Website: Nachricht geht per Mail an die Impressums-
// Adresse, nichts wird gespeichert (Datenschutzerklärung „Kontaktformular“).

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  message: z.string().trim().min(10).max(5000),
  // Honigtopf: für Menschen unsichtbar, Bots füllen ihn aus.
  website: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Zeilenumbrüche aus Kopfzeilen-Werten entfernen (Betreff). */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

/**
 * Stellt die Nachricht zu. Gibt `false` zurück, wenn der Honigtopf gefüllt ist
 * (dann wird still nichts gesendet).
 */
export async function sendContactMessage(
  deps: { mailer: Mailer; to: string },
  input: ContactInput,
): Promise<boolean> {
  if (input.website) return false;
  await deps.mailer.send({
    to: deps.to,
    replyTo: input.email,
    subject: `Kontaktformular: ${oneLine(input.name)}`,
    text: [
      `Name: ${input.name}`,
      `E-Mail: ${input.email}`,
      "",
      input.message,
      "",
      "— gesendet über das Kontaktformular auf roses-gallery.app",
    ].join("\n"),
  });
  return true;
}
