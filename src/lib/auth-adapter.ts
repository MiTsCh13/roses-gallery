import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq, sql } from "drizzle-orm";
import type { Adapter, AdapterUser } from "next-auth/adapters";

import type { Db } from "@/db";
import {
  accounts,
  authAccounts,
  authSessions,
  authVerificationTokens,
  users,
} from "@/db/schema";

function accountNameFor(user: { name?: string | null; email: string }) {
  return user.name?.trim() || user.email.split("@")[0];
}

// Drizzle adapter that makes registration create the tenant: every new Auth.js
// user gets its own Account and becomes its owner (F-ACC-01).
export function createAuthAdapter(db: Db): Adapter {
  const base = DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  } as never);

  return {
    ...base,
    async createUser(data) {
      const email = data.email.toLowerCase();
      return db.transaction(async (tx) => {
        const [account] = await tx
          .insert(accounts)
          .values({ name: accountNameFor({ name: data.name, email }) })
          .returning();
        const [user] = await tx
          .insert(users)
          .values({
            accountId: account.id,
            email,
            name: data.name,
            image: data.image,
            emailVerified: data.emailVerified,
            role: "owner",
          })
          .returning();
        return user as unknown as AdapterUser;
      });
    },
    async getUserByEmail(email) {
      const rows = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
        .limit(1);
      return (rows[0] as unknown as AdapterUser) ?? null;
    },
    async linkAccount(data) {
      await base.linkAccount!(data);
      await db
        .update(users)
        .set({ authProvider: data.provider })
        .where(eq(users.id, data.userId));
    },
  };
}
