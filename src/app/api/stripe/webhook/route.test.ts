import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { accounts } from "@/db/schema";
import { FAKE_SIGNATURE } from "@/lib/billing/fake";
import { createTestDb, resetDb } from "@/test/db";
import { testDatabaseUrl } from "@/test/db-url";

vi.stubEnv("DATABASE_URL", testDatabaseUrl());
vi.stubEnv("REDIS_URL", "redis://localhost:6379");
vi.stubEnv("BILLING_TRANSPORT", "fake");

const { POST } = await import("./route");
const { db, close } = createTestDb();
let accountId: string;

const body = () =>
  JSON.stringify({
    id: "evt_1",
    occurredAt: "2026-10-27T10:00:00.000Z",
    accountId,
    customerId: "cus_1",
    subscriptionId: "sub_1",
    plan: "studio",
    interval: "year",
    status: "active",
    trialEndsAt: null,
    currentPeriodEnd: "2027-10-27T10:00:00.000Z",
  });

const post = (b: string, signature?: string) =>
  POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: b,
      headers: signature ? { "stripe-signature": signature } : {},
    }),
  );

beforeEach(async () => {
  await resetDb(db);
  [{ id: accountId }] = await db
    .insert(accounts)
    .values({ name: "A" })
    .returning();
});
afterAll(() => close());

describe("POST /api/stripe/webhook", () => {
  it("applies a correctly signed event", async () => {
    const res = await post(body(), FAKE_SIGNATURE);
    expect(res.status).toBe(200);
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    expect(row).toMatchObject({ plan: "studio", subscriptionStatus: "active" });
  });

  it("rejects an unsigned or wrongly signed request with 400 and changes nothing", async () => {
    expect((await post(body())).status).toBe(400);
    expect((await post(body(), "nope")).status).toBe(400);
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    expect(row.plan).toBe("free");
  });
});
