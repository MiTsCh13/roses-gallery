"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { attemptUnlock } from "@/lib/gallery-access";
import { serverEnv } from "@/lib/env";
import { getRateLimiter } from "@/lib/rate-limit";

export async function unlockGalleryAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const password = String(formData.get("password") ?? "");
  const env = serverEnv();
  if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET is not configured.");
  const h = await headers();
  const visitor =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const result = await attemptUnlock(
    {
      db: db(),
      limiter: getRateLimiter(env.REDIS_URL),
      secret: env.AUTH_SECRET,
    },
    { slug, password, visitor },
  );
  if (!result.ok) {
    redirect(`/g/${encodeURIComponent(slug)}?error=${result.reason}`);
  }
  (await cookies()).set(result.cookie.name, result.cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: result.cookie.maxAge,
  });
  redirect(`/g/${encodeURIComponent(slug)}`);
}
