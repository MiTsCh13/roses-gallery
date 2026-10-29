"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { serverEnv } from "@/lib/env";
import { allowMagicLinkRequest } from "@/lib/login-limit";
import { getRateLimiter } from "@/lib/rate-limit";

const emailSchema = z.object({ email: z.email().max(254) });

export type LoginState = { error?: "invalid_email" };

export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "invalid_email" };
  const env = serverEnv();
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const allowed = await allowMagicLinkRequest(
    getRateLimiter(env.REDIS_URL),
    parsed.data.email,
    ip,
    // E2E runs share one address and sign in dozens of times.
    env.E2E_TEST_MODE ? 100_000 : undefined,
  );
  // Over the limit: same answer, no mail (D-132).
  if (!allowed) redirect("/login/check-email");
  // redirect: false keeps Auth.js from sending the browser to its own
  // /api/auth/verify-request route, which a client-side navigation cannot render.
  await signIn("email", {
    email: parsed.data.email,
    redirect: false,
    redirectTo: "/dashboard",
  });
  redirect("/login/check-email");
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}
