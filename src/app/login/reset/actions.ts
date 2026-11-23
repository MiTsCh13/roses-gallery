"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";

import { db } from "@/db";
import { serverEnv } from "@/lib/env";
import { getMailer } from "@/lib/mailer";
import {
  PasswordResetError,
  requestPasswordReset,
  resetPassword,
} from "@/lib/password-reset";
import { getRateLimiter } from "@/lib/rate-limit";

const RESET_PER_EMAIL = 5;
const RESET_PER_IP = 20;
const RESET_WINDOW_S = 3600;

export type ResetRequestState = { sent?: boolean; error?: "invalid_email" };

/** Same answer for known and unknown addresses (D-157). */
export async function requestPasswordResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = z
    .object({ email: z.email().max(254) })
    .safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "invalid_email" };
  const env = serverEnv();
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const limiter = getRateLimiter(env.REDIS_URL);
  const scale = env.E2E_TEST_MODE ? 10_000 : 1;
  const [byEmail, byIp] = await Promise.all([
    limiter.hit(
      `pwreset:email:${parsed.data.email.toLowerCase()}`,
      RESET_PER_EMAIL * scale,
      RESET_WINDOW_S,
    ),
    limiter.hit(`pwreset:ip:${ip}`, RESET_PER_IP * scale, RESET_WINDOW_S),
  ]);
  // Over the limit: same answer, no mail.
  if (byEmail.allowed && byIp.allowed) {
    await requestPasswordReset(
      {
        db: db(),
        mailer: getMailer(),
        baseUrl: env.AUTH_URL ?? "http://localhost:3000",
      },
      parsed.data.email,
    );
  }
  return { sent: true };
}

export type ResetState = {
  error?: "too_short" | "mismatch" | "invalid_token";
};

export async function resetPasswordAction(
  token: string,
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = z
    .object({
      token: z.string().max(100),
      password: z.string().max(200),
      confirm: z.string().max(200),
    })
    .safeParse({
      token,
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
  if (!parsed.success) return { error: "too_short" };
  if (parsed.data.password.length < 8) return { error: "too_short" };
  if (parsed.data.password !== parsed.data.confirm)
    return { error: "mismatch" };
  try {
    await resetPassword(
      { db: db(), mailer: getMailer() },
      { token: parsed.data.token, password: parsed.data.password },
    );
  } catch (e) {
    if (e instanceof PasswordResetError) return { error: "invalid_token" };
    if (e instanceof ZodError) return { error: "too_short" };
    throw e;
  }
  redirect("/login/reset/done");
}
