import { serverEnv } from "@/lib/env";
import { getMailer, type FakeMailer } from "@/lib/mailer";

// E2E helper: returns the last mail sent to ?to=. Only available with the fake
// mailer; in a production build it additionally needs E2E_TEST_MODE=1.
export function GET(request: Request) {
  const env = serverEnv();
  const enabled =
    env.MAIL_TRANSPORT === "fake" &&
    (env.NODE_ENV !== "production" || env.E2E_TEST_MODE === "1");
  // Duck-typed: route bundles may each carry their own copy of the class.
  const mailer = (enabled ? getMailer() : undefined) as FakeMailer | undefined;
  if (typeof mailer?.lastTo !== "function") {
    return new Response("Not found", { status: 404 });
  }
  const to = new URL(request.url).searchParams.get("to") ?? "";
  const mail = mailer.lastTo(to);
  return mail
    ? Response.json(mail)
    : new Response("Not found", { status: 404 });
}
