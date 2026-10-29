import { serverEnv } from "@/lib/env";

export type Mail = { to: string; subject: string; text: string; html?: string };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class FakeMailer implements Mailer {
  readonly outbox: Mail[] = [];

  async send(mail: Mail) {
    this.outbox.push(mail);
  }

  lastTo(to: string): Mail | undefined {
    return this.outbox.findLast((m) => m.to.toLowerCase() === to.toLowerCase());
  }
}

export class PostmarkMailer implements Mailer {
  constructor(
    private readonly token: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(mail: Mail) {
    const res = await this.fetchImpl("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.token,
      },
      body: JSON.stringify({
        From: this.from,
        To: mail.to,
        Subject: mail.subject,
        TextBody: mail.text,
        ...(mail.html ? { HtmlBody: mail.html } : {}),
        MessageStream: "outbound",
      }),
    });
    if (!res.ok) {
      throw new Error(`Postmark request failed with status ${res.status}`);
    }
  }
}

const globalForMailer = globalThis as unknown as { mailer?: Mailer };

// Shared per process so the E2E mailbox endpoint sees what the auth route sent.
export function getMailer(): Mailer {
  if (globalForMailer.mailer) return globalForMailer.mailer;
  const env = serverEnv();
  const transport =
    env.MAIL_TRANSPORT ?? (env.POSTMARK_SERVER_TOKEN ? "postmark" : "fake");
  if (transport === "fake") {
    if (env.NODE_ENV === "production" && env.E2E_TEST_MODE !== "1") {
      throw new Error("The fake mailer must not be used in production.");
    }
    globalForMailer.mailer = new FakeMailer();
  } else {
    if (!env.POSTMARK_SERVER_TOKEN || !env.EMAIL_FROM) {
      throw new Error("POSTMARK_SERVER_TOKEN and EMAIL_FROM are required.");
    }
    globalForMailer.mailer = new PostmarkMailer(
      env.POSTMARK_SERVER_TOKEN,
      env.EMAIL_FROM,
    );
  }
  return globalForMailer.mailer;
}
