import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createTranslator } from "next-intl";

import { db } from "@/db";
import { createAuthAdapter } from "@/lib/auth-adapter";
import { serverEnv } from "@/lib/env";
import { getMailer } from "@/lib/mailer";
import messages from "../messages/de.json";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountId: string;
      role: string;
    } & import("next-auth").DefaultSession["user"];
  }
}

export const MAGIC_LINK_MAX_AGE_S = 15 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = serverEnv();
  const t = createTranslator({
    locale: "de",
    messages,
    namespace: "Auth.mail",
  });
  return {
    adapter: createAuthAdapter(db()),
    secret: env.AUTH_SECRET,
    session: { strategy: "database" },
    pages: { signIn: "/login", verifyRequest: "/login/check-email" },
    providers: [
      {
        id: "email",
        type: "email",
        name: "E-Mail",
        from: env.EMAIL_FROM ?? "noreply@localhost",
        maxAge: MAGIC_LINK_MAX_AGE_S,
        options: {},
        async sendVerificationRequest({ identifier, url }) {
          await getMailer().send({
            to: identifier,
            subject: t("subject"),
            text: t("body", { url }),
          });
        },
      },
      ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
        ? [
            Google({
              clientId: env.AUTH_GOOGLE_ID,
              clientSecret: env.AUTH_GOOGLE_SECRET,
              // Google verifies e-mail addresses, so an existing magic-link
              // user can safely sign in with Google later (D-105).
              allowDangerousEmailAccountLinking: true,
            }),
          ]
        : []),
    ],
    callbacks: {
      session({ session, user }) {
        const u = user as unknown as { accountId: string; role: string };
        session.user.id = user.id;
        session.user.accountId = u.accountId;
        session.user.role = u.role;
        return session;
      },
    },
  };
});
