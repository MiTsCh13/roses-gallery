import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, featureRequests, users } from "@/db/schema";
import { FakeMailer } from "@/lib/mailer";
import { createTestDb, resetDb } from "@/test/db";
import { submitFeatureRequest } from "./feature-requests";

const { db, close } = createTestDb();
let who: { accountId: string; userId: string; email: string };

beforeEach(async () => {
  await resetDb(db);
  const [acc] = await db
    .insert(accounts)
    .values({ name: "Studio" })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ accountId: acc.id, email: "foto@rose.de" })
    .returning();
  who = { accountId: acc.id, userId: user.id, email: user.email };
});
afterAll(() => close());

describe("feature requests", () => {
  it("stores the idea for the account and mails it with reply-to", async () => {
    const mailer = new FakeMailer();
    const id = await submitFeatureRequest(
      { db, mailer, to: "hello@example.org" },
      who,
      "  Bitte Galerien duplizieren können.  ",
    );
    const [row] = await db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.id, id));
    expect(row).toMatchObject({
      accountId: who.accountId,
      userId: who.userId,
      text: "Bitte Galerien duplizieren können.",
    });
    const mail = mailer.lastTo("hello@example.org")!;
    expect(mail.replyTo).toBe("foto@rose.de");
    expect(mail.text).toContain("Bitte Galerien duplizieren können.");
  });

  it("still stores the idea when no recipient is configured", async () => {
    const mailer = new FakeMailer();
    await submitFeatureRequest(
      { db, mailer, to: null },
      who,
      "Eine Idee mit Text",
    );
    expect(mailer.outbox).toHaveLength(0);
    expect(await db.select().from(featureRequests)).toHaveLength(1);
  });

  it("rejects too short or too long ideas", async () => {
    const mailer = new FakeMailer();
    await expect(
      submitFeatureRequest({ db, mailer, to: null }, who, "kurz"),
    ).rejects.toThrow();
    await expect(
      submitFeatureRequest({ db, mailer, to: null }, who, "x".repeat(2001)),
    ).rejects.toThrow();
    expect(await db.select().from(featureRequests)).toHaveLength(0);
  });
});
