import { describe, expect, it } from "vitest";

import { FakeMailer } from "@/lib/mailer";
import { contactSchema, sendContactMessage } from "./contact";

const valid = {
  name: "Anna\r\nBcc: x@evil.test",
  email: "anna@example.de",
  message: "Hallo, ich habe eine Frage zur Beta.",
};

describe("contact form", () => {
  it("validates name, e-mail and message length", () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
    expect(
      contactSchema.safeParse({ ...valid, email: "keine-mail" }).success,
    ).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "kurz" }).success).toBe(
      false,
    );
    expect(
      contactSchema.safeParse({ ...valid, message: "x".repeat(5001) }).success,
    ).toBe(false);
  });

  it("mails the message with reply-to and a single-line subject", async () => {
    const mailer = new FakeMailer();
    const input = contactSchema.parse(valid);
    expect(
      await sendContactMessage({ mailer, to: "hello@example.org" }, input),
    ).toBe(true);
    const mail = mailer.lastTo("hello@example.org")!;
    expect(mail.replyTo).toBe("anna@example.de");
    expect(mail.subject).toBe("Kontaktformular: Anna Bcc: x@evil.test");
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.text).toContain("Hallo, ich habe eine Frage zur Beta.");
  });

  it("silently drops submissions with a filled honeypot", async () => {
    const mailer = new FakeMailer();
    const input = contactSchema.parse({ ...valid, website: "http://spam" });
    expect(
      await sendContactMessage({ mailer, to: "h@example.org" }, input),
    ).toBe(false);
    expect(mailer.outbox).toHaveLength(0);
  });
});
