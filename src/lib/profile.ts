import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { accounts, users } from "@/db/schema";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const profileSchema = z.object({
  studioName: z.string().trim().min(1).max(120),
  contactName: optional(120),
  phone: optional(40),
  website: optional(200).refine(
    (v) => v === null || /^https?:\/\/\S+$/i.test(v),
    "website",
  ),
  instagram: optional(60),
});

export type ProfileInput = z.input<typeof profileSchema>;

export type Profile = {
  studioName: string;
  contactName: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  email: string;
};

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

export async function getProfile(
  db: Db,
  accountId: string,
  userId: string,
): Promise<Profile> {
  const [row] = await db
    .select({
      studioName: accounts.name,
      branding: accounts.branding,
      contactName: users.name,
      email: users.email,
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.id, users.accountId))
    .where(and(eq(users.id, userId), eq(users.accountId, accountId)));
  if (!row) throw new Error("Not found.");
  const contact = (row.branding.contact ?? {}) as Record<string, unknown>;
  return {
    studioName: row.studioName,
    contactName: row.contactName,
    phone: str(contact.phone),
    website: str(contact.website),
    instagram: str(contact.instagram),
    email: row.email,
  };
}

/** Saves studio name, contact person and contact data (kept in `branding.contact`). */
export async function saveProfile(
  db: Db,
  accountId: string,
  userId: string,
  input: ProfileInput,
) {
  const data = profileSchema.parse(input);
  await db.transaction(async (tx) => {
    const [account] = await tx
      .select({ branding: accounts.branding })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .for("update");
    if (!account) throw new Error("Not found.");
    await tx
      .update(accounts)
      .set({
        name: data.studioName,
        branding: {
          ...account.branding,
          contact: {
            phone: data.phone,
            website: data.website,
            instagram: data.instagram,
          },
        },
      })
      .where(eq(accounts.id, accountId));
    await tx
      .update(users)
      .set({ name: data.contactName })
      .where(and(eq(users.id, userId), eq(users.accountId, accountId)));
  });
}
