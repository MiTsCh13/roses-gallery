"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";

const emailSchema = z.object({ email: z.email().max(254) });

export type LoginState = { error?: "invalid_email" };

export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "invalid_email" };
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
