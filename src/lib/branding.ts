import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { accounts } from "@/db/schema";
import type { Storage } from "@/lib/storage/types";

export const MAX_LOGO_BYTES = 1_500_000;
export const LOGO_URL_TTL_SECONDS = 10 * 60;

export class BrandingError extends Error {
  constructor(
    readonly code: "logo_invalid" | "logo_too_large" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "BrandingError";
  }
}

type Deps = { db: Db; storage: Storage; accountId: string };

// Types are decided by magic bytes, never by the client's claim. SVG is not
// accepted (script injection risk).
const FORMATS = [
  {
    ext: "png",
    type: "image/png",
    match: (b: Buffer) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: "jpg",
    type: "image/jpeg",
    match: (b: Buffer) =>
      b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  {
    ext: "webp",
    type: "image/webp",
    match: (b: Buffer) =>
      b.subarray(0, 4).toString("latin1") === "RIFF" &&
      b.subarray(8, 12).toString("latin1") === "WEBP",
  },
] as const;

async function currentKey(db: Db, accountId: string) {
  const [row] = await db
    .select({ branding: accounts.branding })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!row) throw new BrandingError("not_found", "Account not found.");
  const key = row.branding.logoKey;
  return { branding: row.branding, key: typeof key === "string" ? key : null };
}

/** Stores the account's logo (replacing and deleting a previous one). */
export async function setLogo(deps: Deps, bytes: Buffer) {
  if (bytes.length > MAX_LOGO_BYTES)
    throw new BrandingError("logo_too_large", "Logo too large.");
  const format = FORMATS.find((f) => f.match(bytes));
  if (!format) throw new BrandingError("logo_invalid", "Unsupported logo.");
  const { branding, key: old } = await currentKey(deps.db, deps.accountId);
  const key = `${deps.accountId}/branding/logo-${crypto.randomUUID()}.${format.ext}`;
  await deps.storage.put(key, bytes, format.type);
  await deps.db
    .update(accounts)
    .set({ branding: { ...branding, logoKey: key } })
    .where(eq(accounts.id, deps.accountId));
  if (old) await deps.storage.delete(old);
}

export async function removeLogo(deps: Deps) {
  const { branding, key } = await currentKey(deps.db, deps.accountId);
  if (!key) return;
  const { logoKey: _drop, ...rest } = branding;
  void _drop;
  await deps.db
    .update(accounts)
    .set({ branding: rest })
    .where(eq(accounts.id, deps.accountId));
  await deps.storage.delete(key);
}

/** Short-lived signed URL of the account's logo, or null. */
export async function logoUrl(deps: Deps): Promise<string | null> {
  const { key } = await currentKey(deps.db, deps.accountId);
  return key ? deps.storage.signGet(key, LOGO_URL_TTL_SECONDS) : null;
}
