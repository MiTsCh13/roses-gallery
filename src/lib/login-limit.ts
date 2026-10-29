import type { RateLimiter } from "./rate-limit";

// Drosselt Anmeldelink-Anfragen (Mail-Flut, Konto-Spam). Pro Adresse und pro IP;
// bei Überschreitung wird kein Link versendet, die UI antwortet gleich (keine
// Auskunft über Konten, D-132).
export const MAGIC_LINK_PER_EMAIL = 5;
export const MAGIC_LINK_PER_IP = 20;
export const MAGIC_LINK_WINDOW_S = 3600;

export async function allowMagicLinkRequest(
  limiter: RateLimiter,
  email: string,
  ip: string,
  perIp = MAGIC_LINK_PER_IP,
): Promise<boolean> {
  const [byEmail, byIp] = await Promise.all([
    limiter.hit(
      `login:email:${email.toLowerCase()}`,
      MAGIC_LINK_PER_EMAIL,
      MAGIC_LINK_WINDOW_S,
    ),
    limiter.hit(`login:ip:${ip}`, perIp, MAGIC_LINK_WINDOW_S),
  ]);
  return byEmail.allowed && byIp.allowed;
}
