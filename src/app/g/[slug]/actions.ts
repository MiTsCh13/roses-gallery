"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { attemptUnlock } from "@/lib/gallery-access";
import { serverEnv } from "@/lib/env";
import { getRateLimiter } from "@/lib/rate-limit";
import { createQueue, enqueue } from "@/lib/queue";
import { accessCookieName } from "@/lib/gallery-access";
import { requestZipExport, zipRequestSchema } from "@/lib/zip-exports";

let zipQueue: ReturnType<typeof createQueue> | undefined;

async function visitorId() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function unlockGalleryAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const password = String(formData.get("password") ?? "");
  const env = serverEnv();
  if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET is not configured.");
  const visitor = await visitorId();
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

async function createZip(slug: string, size: unknown, email?: string) {
  const parsed = zipRequestSchema.safeParse({ slug, size, email });
  if (!parsed.success) return { ok: false as const, reason: "invalid" };
  const env = serverEnv();
  const limit = await getRateLimiter(env.REDIS_URL).hit(
    `zip:${await visitorId()}`,
    5,
    60 * 60,
  );
  if (!limit.allowed) return { ok: false as const, reason: "rate_limited" };

  zipQueue ??= createQueue(env.REDIS_URL);
  const queue = zipQueue;
  const jar = await cookies();
  return requestZipExport(
    {
      db: db(),
      enqueue: async (payload) => {
        await enqueue(queue, "build-zip", payload);
      },
      accessSecret: env.AUTH_SECRET,
      accessToken: (id) => jar.get(accessCookieName(id))?.value,
    },
    parsed.data,
  );
}

/** ZIP download by mail (F-SEC-02): queues the build, the link follows by mail. */
export async function requestZipAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const result = await createZip(
    slug,
    formData.get("size"),
    String(formData.get("email") ?? "").trim(),
  );
  redirect(
    `/g/${encodeURIComponent(slug)}?zip=${result.ok ? "sent" : result.reason}`,
  );
}

/** Direct ZIP download: queues the build; the browser polls and then downloads. */
export async function startZipAction(
  slug: string,
  size: string,
): Promise<{ ok: true; exportId: string } | { ok: false; reason: string }> {
  return createZip(String(slug), size);
}
