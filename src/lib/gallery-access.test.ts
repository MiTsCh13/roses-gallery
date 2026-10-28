import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, galleries } from "@/db/schema";
import { createTestDb, resetDb } from "@/test/db";
import {
  accessCookieName,
  attemptUnlock,
  createAccessToken,
  hashPassword,
  setGalleryPassword,
  UNLOCK_LIMIT,
  verifyAccessToken,
  verifyPassword,
} from "./gallery-access";
import { MemoryRateLimiter } from "./rate-limit";

const { db, close } = createTestDb();
const SECRET = "test-secret-with-enough-length";
let accountId: string;
let otherId: string;

async function gallery(values: Partial<typeof galleries.$inferInsert> = {}) {
  const [g] = await db
    .insert(galleries)
    .values({
      accountId,
      slug: "anna-ben",
      title: "Anna & Ben",
      status: "published",
      ...values,
    })
    .returning();
  return g;
}

beforeEach(async () => {
  await resetDb(db);
  const [a, b] = await db
    .insert(accounts)
    .values([{ name: "A" }, { name: "B" }])
    .returning();
  accountId = a.id;
  otherId = b.id;
});
afterAll(close);

describe("password hashing", () => {
  it("verifies the right password and salts every hash", () => {
    const h = hashPassword("geheim-1");
    expect(h).not.toContain("geheim-1");
    expect(verifyPassword("geheim-1", h)).toBe(true);
    expect(verifyPassword("geheim-2", h)).toBe(false);
    expect(hashPassword("geheim-1")).not.toBe(h);
  });

  it("rejects malformed hashes", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "md5$a$b")).toBe(false);
  });
});

describe("access token", () => {
  const g = { id: "11111111-1111-4111-8111-111111111111", passwordHash: "h1" };

  it("is valid for its gallery until it expires", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const token = createAccessToken(SECRET, g, now);
    expect(verifyAccessToken(SECRET, g, token, now)).toBe(true);
    expect(
      verifyAccessToken(SECRET, g, token, new Date("2026-02-01T00:00:00Z")),
    ).toBe(false);
  });

  it("is bound to gallery, secret and current password hash", () => {
    const token = createAccessToken(SECRET, g);
    expect(verifyAccessToken("other-secret-other-secret", g, token)).toBe(
      false,
    );
    expect(
      verifyAccessToken(
        SECRET,
        { ...g, id: "22222222-2222-4222-8222-222222222222" },
        token,
      ),
    ).toBe(false);
    expect(verifyAccessToken(SECRET, { ...g, passwordHash: "h2" }, token)).toBe(
      false,
    );
    expect(verifyAccessToken(SECRET, g, undefined)).toBe(false);
    expect(verifyAccessToken(SECRET, g, "garbage")).toBe(false);
    // a forged, later expiry does not match the signature
    const [, mac] = token.split(".");
    expect(verifyAccessToken(SECRET, g, `99999999999.${mac}`)).toBe(false);
  });
});

describe("setGalleryPassword", () => {
  it("sets, replaces and removes the password", async () => {
    const g = await gallery();
    await setGalleryPassword({ db, accountId }, g.id, "geheim-1");
    const [set] = await db.select().from(galleries);
    expect(verifyPassword("geheim-1", set.passwordHash!)).toBe(true);
    await setGalleryPassword({ db, accountId }, g.id, null);
    const [cleared] = await db.select().from(galleries);
    expect(cleared.passwordHash).toBeNull();
  });

  it("rejects short passwords and foreign galleries", async () => {
    const g = await gallery();
    await expect(
      setGalleryPassword({ db, accountId }, g.id, "abc"),
    ).rejects.toThrow();
    await expect(
      setGalleryPassword({ db, accountId: otherId }, g.id, "geheim-1"),
    ).rejects.toMatchObject({ code: "not_found" });
    const [row] = await db.select().from(galleries);
    expect(row.passwordHash).toBeNull();
  });
});

describe("attemptUnlock", () => {
  async function protectedGallery() {
    const g = await gallery({ passwordHash: hashPassword("geheim-1") });
    return g;
  }
  const deps = () => ({ db, limiter: new MemoryRateLimiter(), secret: SECRET });

  it("returns a cookie that unlocks exactly this gallery", async () => {
    const g = await protectedGallery();
    const r = await attemptUnlock(deps(), {
      slug: "anna-ben",
      password: "geheim-1",
      visitor: "1.2.3.4",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cookie.name).toBe(accessCookieName(g.id));
    expect(
      verifyAccessToken(
        SECRET,
        { id: g.id, passwordHash: g.passwordHash! },
        r.cookie.value,
      ),
    ).toBe(true);
  });

  it("refuses a wrong password, unknown slugs and unprotected galleries", async () => {
    await protectedGallery();
    const d = deps();
    const ask = (slug: string, password: string) =>
      attemptUnlock(d, { slug, password, visitor: "v" });
    expect(await ask("anna-ben", "falsch")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await ask("gibt-es-nicht", "geheim-1")).toEqual({
      ok: false,
      reason: "not_found",
    });
    await db.update(galleries).set({ passwordHash: null });
    expect(await ask("anna-ben", "geheim-1")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("does not unlock drafts or expired galleries", async () => {
    await gallery({ passwordHash: hashPassword("geheim-1"), status: "draft" });
    expect(
      await attemptUnlock(deps(), {
        slug: "anna-ben",
        password: "geheim-1",
        visitor: "v",
      }),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("blocks a visitor after too many guesses, even with the right password", async () => {
    await protectedGallery();
    const d = deps();
    const guess = (password: string, visitor = "1.2.3.4") =>
      attemptUnlock(d, { slug: "anna-ben", password, visitor });
    for (let i = 0; i < UNLOCK_LIMIT.perVisitor; i++) {
      expect(await guess("falsch")).toMatchObject({ reason: "invalid" });
    }
    const blocked = await guess("geheim-1");
    expect(blocked).toMatchObject({ ok: false, reason: "rate_limited" });
    // another visitor is not affected
    expect((await guess("geheim-1", "5.6.7.8")).ok).toBe(true);
  });
});
