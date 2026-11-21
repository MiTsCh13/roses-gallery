"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { db } from "@/db";
import {
  SESSION_MAX_AGE_S,
  authenticateWithPassword,
  createPasswordSession,
} from "@/lib/account-password";
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

const passwordLoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export type PasswordLoginState = {
  error?: "invalid_credentials" | "rate_limited";
};

const PASSWORD_LOGIN_PER_EMAIL = 10;
const PASSWORD_LOGIN_WINDOW_S = 600;

/** E-Mail + Passwort (D-141); gleiche Antwort für unbekannte Adresse und falsches Passwort. */
export async function signInWithPassword(
  _prev: PasswordLoginState,
  formData: FormData,
): Promise<PasswordLoginState> {
  const parsed = passwordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid_credentials" };
  const env = serverEnv();
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const limiter = getRateLimiter(env.REDIS_URL);
  const max = env.E2E_TEST_MODE ? 100_000 : PASSWORD_LOGIN_PER_EMAIL;
  const [byEmail, byIp] = await Promise.all([
    limiter.hit(
      `pwlogin:email:${parsed.data.email.toLowerCase()}`,
      max,
      PASSWORD_LOGIN_WINDOW_S,
    ),
    limiter.hit(`pwlogin:ip:${ip}`, max * 4, PASSWORD_LOGIN_WINDOW_S),
  ]);
  if (!byEmail.allowed || !byIp.allowed) return { error: "rate_limited" };

  const user = await authenticateWithPassword(
    db(),
    parsed.data.email,
    parsed.data.password,
  );
  if (!user) return { error: "invalid_credentials" };

  const { sessionToken, expires } = await createPasswordSession(db(), user.id);
  const secure = env.AUTH_URL?.startsWith("https://") ?? false;
  (await cookies()).set(
    `${secure ? "__Secure-" : ""}authjs.session-token`,
    sessionToken,
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      expires,
      maxAge: SESSION_MAX_AGE_S,
    },
  );
  // requireAccount() leitet bei aktiver 2FA selbst auf /login/2fa um.
  redirect("/dashboard");
}
