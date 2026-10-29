"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { serverEnv } from "@/lib/env";
import { getRateLimiter } from "@/lib/rate-limit";
import { requireAccount } from "@/lib/session";
import { readSessionToken } from "@/lib/two-factor-session";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  markSessionVerified,
  startTwoFactorSetup,
} from "@/lib/two-factor";

const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });

export type SecurityState = {
  error?: "invalid" | "rate_limited";
  recoveryCodes?: string[];
};

function authSecret() {
  const secret = serverEnv().AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return secret;
}

async function allowed(userId: string) {
  const limit = await getRateLimiter(serverEnv().REDIS_URL).hit(
    `2fa:${userId}`,
    5,
    600,
  );
  return limit.allowed;
}

export async function startSetup() {
  const { user } = await requireAccount();
  await startTwoFactorSetup(db(), authSecret(), user.id);
  revalidatePath("/dashboard/security");
}

export async function confirmSetup(
  _prev: SecurityState,
  formData: FormData,
): Promise<SecurityState> {
  const { user } = await requireAccount();
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "invalid" };
  if (!(await allowed(user.id))) return { error: "rate_limited" };
  const result = await confirmTwoFactorSetup(
    db(),
    authSecret(),
    user.id,
    parsed.data.code,
  );
  if (!result) return { error: "invalid" };
  const token = await readSessionToken();
  if (token) await markSessionVerified(db(), token, user.id);
  return { recoveryCodes: result.recoveryCodes };
}

export async function disableSetup(
  _prev: SecurityState,
  formData: FormData,
): Promise<SecurityState> {
  const { user } = await requireAccount();
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "invalid" };
  if (!(await allowed(user.id))) return { error: "rate_limited" };
  if (!(await disableTwoFactor(db(), authSecret(), user.id, parsed.data.code)))
    return { error: "invalid" };
  revalidatePath("/dashboard/security");
  return {};
}
