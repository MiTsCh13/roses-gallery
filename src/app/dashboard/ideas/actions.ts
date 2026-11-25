"use server";

import { ZodError } from "zod";

import { db } from "@/db";
import { serverEnv } from "@/lib/env";
import { submitFeatureRequest } from "@/lib/feature-requests";
import { LEGAL_MISSING, legalDetails } from "@/lib/legal-details";
import { getMailer } from "@/lib/mailer";
import { getRateLimiter } from "@/lib/rate-limit";
import { requireAccount } from "@/lib/session";

export type IdeaState = { sent?: boolean; error?: "invalid" | "rate_limited" };

const PER_ACCOUNT = 10;
const WINDOW_S = 3600;

export async function submitIdeaAction(
  _prev: IdeaState,
  formData: FormData,
): Promise<IdeaState> {
  const { user, account } = await requireAccount();
  const env = serverEnv();
  const limit = await getRateLimiter(env.REDIS_URL).hit(
    `ideas:account:${account.id}`,
    env.E2E_TEST_MODE ? 10_000 : PER_ACCOUNT,
    WINDOW_S,
  );
  if (!limit.allowed) return { error: "rate_limited" };
  const to = legalDetails().LEGAL_EMAIL;
  try {
    await submitFeatureRequest(
      { db: db(), mailer: getMailer(), to: to === LEGAL_MISSING ? null : to },
      { accountId: account.id, userId: user.id, email: user.email ?? "" },
      formData.get("idea"),
    );
  } catch (e) {
    if (e instanceof ZodError) return { error: "invalid" };
    throw e;
  }
  return { sent: true };
}
