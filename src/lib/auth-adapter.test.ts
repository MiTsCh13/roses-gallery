import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, users } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import { createAuthAdapter } from "./auth-adapter";

const { db, close } = createTestDb();
const adapter = createAuthAdapter(db as never);

beforeEach(() => resetDb(db));
afterAll(() => close());

describe("auth adapter", () => {
  it("creates an account with the owner user on registration", async () => {
    const user = await adapter.createUser!({
      id: "ignored",
      email: "Anna@Foto-Rose.de",
      emailVerified: new Date(),
    });

    const [row] = await db.select().from(users);
    expect(row.id).toBe(user.id);
    expect(row.email).toBe("anna@foto-rose.de");
    expect(row.role).toBe("owner");
    const [account] = await db.select().from(accounts);
    expect(row.accountId).toBe(account.id);
    expect(account.name).toBe("anna");
  });

  it("looks users up by e-mail case-insensitively", async () => {
    const user = await adapter.createUser!({
      id: "x",
      email: "a@b.de",
      emailVerified: null,
    });
    expect((await adapter.getUserByEmail!("A@B.de"))?.id).toBe(user.id);
    expect(await adapter.getUserByEmail!("other@b.de")).toBeNull();
  });

  it("records the auth provider when an account is linked", async () => {
    const user = await adapter.createUser!({
      id: "x",
      email: "a@b.de",
      emailVerified: null,
    });
    await adapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "g-1",
    });
    const [row] = await db.select().from(users);
    expect(row.authProvider).toBe("google");
    expect(
      (
        await adapter.getUserByAccount!({
          provider: "google",
          providerAccountId: "g-1",
        })
      )?.id,
    ).toBe(user.id);
  });

  it("stores and consumes magic-link tokens once", async () => {
    const expires = new Date(Date.now() + 60_000);
    await adapter.createVerificationToken!({
      identifier: "a@b.de",
      token: "t",
      expires,
    });
    expect(
      await adapter.useVerificationToken!({ identifier: "a@b.de", token: "t" }),
    ).not.toBeNull();
    expect(
      await adapter.useVerificationToken!({ identifier: "a@b.de", token: "t" }),
    ).toBeNull();
  });
});
