import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, users } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { getProfile, saveProfile } from "./profile";

const { db, close } = createTestDb();
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

beforeEach(async () => {
  await resetDb(db);
  a = await seed("Studio A", "a@example.de");
  b = await seed("Studio B", "b@example.de");
});
afterAll(() => close());

describe("profile", () => {
  it("saves studio, contact person and contact data", async () => {
    await saveProfile(db, a.accountId, a.userId, {
      studioName: " Foto Rose ",
      contactName: "Anna Rose",
      phone: "+49 170 1234567",
      website: "https://foto-rose.de",
      instagram: "@fotorose",
    });
    expect(await getProfile(db, a.accountId, a.userId)).toEqual({
      studioName: "Foto Rose",
      contactName: "Anna Rose",
      phone: "+49 170 1234567",
      website: "https://foto-rose.de",
      instagram: "@fotorose",
      email: "a@example.de",
    });
  });

  it("stores empty optional fields as null and keeps the logo key", async () => {
    await db
      .update(accounts)
      .set({ branding: { logoKey: "x/logo.png" } })
      .where(eq(accounts.id, a.accountId));
    await saveProfile(db, a.accountId, a.userId, {
      studioName: "Foto Rose",
      contactName: "",
      phone: "",
      website: "",
      instagram: "",
    });
    const profile = await getProfile(db, a.accountId, a.userId);
    expect(profile.contactName).toBeNull();
    expect(profile.website).toBeNull();
    const [row] = await db
      .select({ branding: accounts.branding })
      .from(accounts)
      .where(eq(accounts.id, a.accountId));
    expect(row.branding.logoKey).toBe("x/logo.png");
  });

  it("rejects an empty studio name and a website without scheme", async () => {
    const base = {
      studioName: "X",
      contactName: "",
      phone: "",
      website: "",
      instagram: "",
    };
    await expect(
      saveProfile(db, a.accountId, a.userId, { ...base, studioName: " " }),
    ).rejects.toThrow();
    await expect(
      saveProfile(db, a.accountId, a.userId, {
        ...base,
        website: "foto-rose.de",
      }),
    ).rejects.toThrow();
  });

  it("never touches another account's user", async () => {
    await saveProfile(db, a.accountId, b.userId, {
      studioName: "Hijack",
      contactName: "Mallory",
      phone: "",
      website: "",
      instagram: "",
    });
    const other = await getProfile(db, b.accountId, b.userId);
    expect(other.contactName).toBeNull();
    expect(other.studioName).toBe("Studio B");
  });
});
