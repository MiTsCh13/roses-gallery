"use server";

import { headers } from "next/headers";

import { contactSchema, sendContactMessage } from "@/lib/contact";
import { serverEnv } from "@/lib/env";
import { LEGAL_MISSING, legalDetails } from "@/lib/legal-details";
import { getMailer } from "@/lib/mailer";
import { getRateLimiter } from "@/lib/rate-limit";

export type ContactState = {
  sent?: boolean;
  error?: "invalid" | "rate_limited" | "unavailable";
};

const PER_IP = 5;
const PER_EMAIL = 3;
const WINDOW_S = 3600;

export async function sendContactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const to = legalDetails().LEGAL_EMAIL;
  if (to === LEGAL_MISSING) return { error: "unavailable" };

  const env = serverEnv();
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const limiter = getRateLimiter(env.REDIS_URL);
  const scale = env.E2E_TEST_MODE ? 10_000 : 1;
  const [byIp, byEmail] = await Promise.all([
    limiter.hit(`contact:ip:${ip}`, PER_IP * scale, WINDOW_S),
    limiter.hit(
      `contact:email:${parsed.data.email.toLowerCase()}`,
      PER_EMAIL * scale,
      WINDOW_S,
    ),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return { error: "rate_limited" };

  // Honigtopf gefüllt: gleiche Antwort, aber nichts senden.
  await sendContactMessage({ mailer: getMailer(), to }, parsed.data);
  return { sent: true };
}
