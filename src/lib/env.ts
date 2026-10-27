import { z } from "zod";

// Server-side environment. Parsed lazily so `next build` and unit tests work
// without a full .env; the first access at runtime fails fast on bad config.
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  AUTH_SECRET: z.string().min(16).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  MAIL_TRANSPORT: z.enum(["postmark", "fake"]).optional(),
  POSTMARK_SERVER_TOKEN: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  // Allows the fake mailer and /api/test/mailbox in a production build (E2E only).
  E2E_TEST_MODE: z.enum(["1"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>) {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
