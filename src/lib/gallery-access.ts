import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { galleries } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { GalleryError } from "@/lib/galleries";
import type { RateLimiter } from "@/lib/rate-limit";

// Password protection for public galleries (F-SEC-01). Passwords are hashed
// with scrypt; a successful unlock is remembered in a signed, gallery-specific
// cookie that stops working as soon as the password changes.

const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 32 } as const;
export const ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;

export const passwordSchema = z.string().min(6).max(200);

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT.keyLen, SCRYPT);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = scryptSync(
    password,
    Buffer.from(salt, "base64url"),
    expected.length,
    SCRYPT,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Sets (or, with null/empty, removes) the gallery password of this account. */
export async function setGalleryPassword(
  deps: { db: Db; accountId: string },
  galleryId: string,
  password: string | null,
) {
  z.uuid().parse(galleryId);
  const t = tenantDb(deps.db, deps.accountId);
  const hash = password ? hashPassword(passwordSchema.parse(password)) : null;
  const row = await t.galleries.update(galleryId, { passwordHash: hash });
  if (!row) throw new GalleryError("not_found", "Gallery not found.");
}

export const accessCookieName = (galleryId: string) => `rg-access-${galleryId}`;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// binds the token to the current hash, so a new password revokes old cookies
function fingerprint(passwordHash: string): string {
  return createHmac("sha256", "fp").update(passwordHash).digest("base64url");
}

export function createAccessToken(
  secret: string,
  gallery: { id: string; passwordHash: string },
  now = new Date(),
): string {
  const exp = Math.floor(now.getTime() / 1000) + ACCESS_TTL_SECONDS;
  const payload = `${gallery.id}.${exp}.${fingerprint(gallery.passwordHash)}`;
  return `${exp}.${sign(secret, payload)}`;
}

export function verifyAccessToken(
  secret: string,
  gallery: { id: string; passwordHash: string },
  token: string | undefined,
  now = new Date(),
): boolean {
  if (!token) return false;
  const [expRaw, mac] = token.split(".");
  const exp = Number(expRaw);
  if (!mac || !Number.isInteger(exp) || exp * 1000 <= now.getTime()) {
    return false;
  }
  const expected = sign(
    secret,
    `${gallery.id}.${exp}.${fingerprint(gallery.passwordHash)}`,
  );
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const UNLOCK_LIMIT = { perVisitor: 5, perGallery: 60 } as const;
export const UNLOCK_WINDOW_SECONDS = 10 * 60;

export type UnlockResult =
  | { ok: true; cookie: { name: string; value: string; maxAge: number } }
  | { ok: false; reason: "invalid" | "not_found" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

/**
 * Checks a visitor's password guess. Attempts are counted before the hash is
 * compared, per visitor (IP) and per gallery, so guessing is slow either way.
 */
export async function attemptUnlock(
  deps: { db: Db; limiter: RateLimiter; secret: string; now?: Date },
  input: { slug: string; password: string; visitor: string },
): Promise<UnlockResult> {
  const slug = input.slug.slice(0, 80);
  const visitor = await deps.limiter.hit(
    `gallery-pw:${slug}:${input.visitor}`,
    UNLOCK_LIMIT.perVisitor,
    UNLOCK_WINDOW_SECONDS,
  );
  const overall = await deps.limiter.hit(
    `gallery-pw:${slug}`,
    UNLOCK_LIMIT.perGallery,
    6 * UNLOCK_WINDOW_SECONDS,
  );
  if (!visitor.allowed || !overall.allowed) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: Math.max(
        visitor.retryAfterSeconds,
        overall.retryAfterSeconds,
      ),
    };
  }
  const now = deps.now ?? new Date();
  const [g] = await deps.db
    .select()
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);
  if (
    !g?.passwordHash ||
    g.status !== "published" ||
    (g.expiresAt && g.expiresAt <= now)
  ) {
    return { ok: false, reason: "not_found" };
  }
  if (!verifyPassword(input.password.slice(0, 200), g.passwordHash)) {
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    cookie: {
      name: accessCookieName(g.id),
      value: createAccessToken(
        deps.secret,
        { id: g.id, passwordHash: g.passwordHash },
        now,
      ),
      maxAge: ACCESS_TTL_SECONDS,
    },
  };
}
