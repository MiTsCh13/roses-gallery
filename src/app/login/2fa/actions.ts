"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { serverEnv } from "@/lib/env";
import { getRateLimiter } from "@/lib/rate-limit";
import { completeSecondFactor } from "@/lib/two-factor";
import { readSessionToken } from "@/lib/two-factor-session";

const schema = z.object({ code: z.string().trim().min(6).max(20) });

export type TwoFactorLoginState = { error?: "invalid" | "rate_limited" };

export async function verifySecondFactor(
  _prev: TwoFactorLoginState,
  formData: FormData,
): Promise<TwoFactorLoginState> {
  const session = await auth();
  const sessionToken = await readSessionToken();
  if (!session?.user || !sessionToken) redirect("/login");
  if (!session.user.secondFactorPending) redirect("/dashboard");

  const parsed = schema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "invalid" };

  const env = serverEnv();
  if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET is not configured.");
  const limit = await getRateLimiter(env.REDIS_URL).hit(
    `2fa:${session.user.id}`,
    5,
    600,
  );
  if (!limit.allowed) return { error: "rate_limited" };

  const ok = await completeSecondFactor(db(), env.AUTH_SECRET, {
    sessionToken,
    userId: session.user.id,
    code: parsed.data.code,
  });
  if (!ok) return { error: "invalid" };
  redirect("/dashboard");
}

export async function cancelSecondFactor() {
  await signOut({ redirectTo: "/login" });
}
