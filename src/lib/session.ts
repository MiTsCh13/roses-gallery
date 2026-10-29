import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { accounts } from "@/db/schema";

/** Session user + their account row; redirects to /login when signed out. */
export async function requireAccount() {
  const session = await auth();
  if (session?.user?.secondFactorPending) redirect("/login/2fa");
  if (!session?.user?.accountId) redirect("/login");
  const [account] = await db()
    .select()
    .from(accounts)
    .where(eq(accounts.id, session.user.accountId))
    .limit(1);
  if (!account) redirect("/login");
  return { user: session.user, account };
}
