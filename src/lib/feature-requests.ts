import { z } from "zod";

import type { Db } from "@/db";
import { featureRequests } from "@/db/schema";
import type { Mailer } from "@/lib/mailer";

// Ideen/Feature-Wünsche aus dem Dashboard: Zeile je Idee (Mandant = Konto),
// dazu eine Mail an den Betreiber, falls eine Adresse hinterlegt ist.

export const featureRequestSchema = z.string().trim().min(10).max(2000);

export async function submitFeatureRequest(
  deps: { db: Db; mailer: Mailer; to: string | null },
  who: { accountId: string; userId: string; email: string },
  rawText: unknown,
) {
  const text = featureRequestSchema.parse(rawText);
  const [row] = await deps.db
    .insert(featureRequests)
    .values({ accountId: who.accountId, userId: who.userId, text })
    .returning({ id: featureRequests.id });
  if (deps.to) {
    await deps.mailer.send({
      to: deps.to,
      replyTo: who.email,
      subject: "Neue Idee für Roses Gallery",
      text: [`Von: ${who.email}`, "", text, "", `ID: ${row.id}`].join("\n"),
    });
  }
  return row.id;
}
