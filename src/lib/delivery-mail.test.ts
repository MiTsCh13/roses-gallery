import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, visitors } from "@/db/schema";
import { tenantDb } from "@/db/tenant";
import { createTestDb, resetDb } from "@/test/db";
import {
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  deliveryDraft,
  DeliveryError,
  fillTemplate,
  listDeliveries,
  parseRecipients,
  renderHtml,
  sendDeliveryMail,
} from "./delivery-mail";
import { FakeMailer, type Mail, type Mailer } from "./mailer";

const { db, close } = createTestDb();
let accountId: string;
let otherId: string;
let mailer: FakeMailer;

beforeEach(async () => {
  await resetDb(db);
  mailer = new FakeMailer();
  [{ id: accountId }, { id: otherId }] = await db
    .insert(accounts)
    .values([{ name: "Foto Rose" }, { name: "Andere" }])
    .returning();
});
afterAll(() => close());

const deps = () => ({
  db,
  mailer,
  baseUrl: "https://roses.example/",
  accountId,
});

async function gallery(
  status: "draft" | "published" = "published",
  passwordHash: string | null = null,
) {
  return tenantDb(db, accountId).galleries.create({
    slug: "anna-ben",
    title: "Anna & Ben",
    status,
    passwordHash,
  });
}

const form = (galleryId: string, over: Record<string, string> = {}) => ({
  galleryId,
  subject: DEFAULT_SUBJECT,
  body: DEFAULT_BODY,
  recipients: "anna@example.com, ben@example.com",
  ...over,
});

describe("helpers", () => {
  it("parses, lowercases and dedupes recipients", () => {
    expect(parseRecipients("A@x.de; a@x.de\n b@x.de,, ")).toEqual([
      "a@x.de",
      "b@x.de",
    ]);
  });

  it("fills placeholders in one pass and keeps unknown ones", () => {
    expect(fillTemplate("{a} {b} {c}", { a: "{b}", b: "x" })).toBe("{b} x {c}");
  });

  it("escapes HTML and links the gallery URL", () => {
    const html = renderHtml(
      "<b>Hi</b>\nhttps://x.de/g/a",
      "https://x.de/g/a",
      "A&B",
    );
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt;<br>");
    expect(html).toContain('<a href="https://x.de/g/a">https://x.de/g/a</a>');
    expect(html).toContain("A&amp;B");
  });
});

describe("deliveryDraft", () => {
  const base = {
    title: "Anna & Ben",
    link: "https://roses.example/g/anna-ben",
    creator: "Foto Rose",
  };

  it("fills in title, link and photographer, without placeholders", () => {
    const d = deliveryDraft({ ...base, hasPassword: false });
    expect(d.subject).toBe("Eure Galerie „Anna & Ben“ ist da ✨");
    expect(d.body).toContain("Galerie „Anna & Ben“ fertig");
    expect(d.body).toContain("https://roses.example/g/anna-ben");
    expect(d.body.endsWith("Foto Rose")).toBe(true);
    expect(d.body).not.toContain("{");
    expect(d.body).not.toMatch(/\n{3,}/);
    expect(d.body).not.toContain("passwortgeschützt");
  });

  it("mentions the password only for protected galleries", () => {
    const d = deliveryDraft({ ...base, hasPassword: true });
    expect(d.body).toContain("passwortgeschützt");
    expect(d.body).toContain("teilt Euch Foto Rose separat mit");
  });
});

describe("sendDeliveryMail", () => {
  it("sends text and HTML with the gallery link, logs and registers clients", async () => {
    const g = await gallery();
    const result = await sendDeliveryMail(deps(), form(g.id));
    expect(result).toEqual({ sent: 2, failed: 0 });

    const mail = mailer.lastTo("anna@example.com")!;
    expect(mail.subject).toBe("Eure Galerie „Anna & Ben“ ist da ✨");
    expect(mail.text).toContain("https://roses.example/g/anna-ben");
    expect(mail.text).toContain("Foto Rose");
    expect(mail.text).not.toContain("{");
    expect(mail.text).not.toMatch(/\n{3,}/);
    expect(mail.text).not.toContain("passwortgeschützt");
    expect(mail.html).toContain('href="https://roses.example/g/anna-ben"');

    const log = await listDeliveries(db, accountId, g.id);
    expect(log.map((l) => [l.recipient, l.status]).sort()).toEqual([
      ["anna@example.com", "sent"],
      ["ben@example.com", "sent"],
    ]);
    const clients = await db.select().from(visitors);
    expect(clients.map((c) => c.role)).toEqual(["client", "client"]);

    // sending again does not duplicate the client rows
    await sendDeliveryMail(deps(), form(g.id));
    expect(await db.select().from(visitors)).toHaveLength(2);
  });

  it("adds the password hint without revealing the password", async () => {
    const g = await gallery("published", "hash");
    await sendDeliveryMail(deps(), form(g.id, { recipients: "a@x.de" }));
    const text = mailer.lastTo("a@x.de")!.text;
    expect(text).toContain("passwortgeschützt");
    expect(text).toContain("Foto Rose");
    expect(text).not.toContain("hash");
  });

  it("uses an edited text", async () => {
    const g = await gallery();
    await sendDeliveryMail(
      deps(),
      form(g.id, {
        recipients: "a@x.de",
        subject: "Hallo {titel}",
        body: "Schau: {link}",
      }),
    );
    const mail = mailer.lastTo("a@x.de")!;
    expect(mail.subject).toBe("Hallo Anna & Ben");
    expect(mail.text).toBe("Schau: https://roses.example/g/anna-ben");
  });

  it("logs failures and continues with the other recipients", async () => {
    const g = await gallery();
    const flaky: Mailer = {
      async send(mail: Mail) {
        if (mail.to === "anna@example.com") throw new Error("boom");
        await mailer.send(mail);
      },
    };
    const result = await sendDeliveryMail(
      { ...deps(), mailer: flaky },
      form(g.id),
    );
    expect(result).toEqual({ sent: 1, failed: 1 });
    const log = await listDeliveries(db, accountId, g.id);
    expect(log.find((l) => l.recipient === "anna@example.com")?.status).toBe(
      "failed",
    );
    // a failed recipient is not registered as a client
    expect((await db.select().from(visitors)).map((v) => v.email)).toEqual([
      "ben@example.com",
    ]);
  });

  it("rejects invalid input, drafts, foreign galleries and too many recipients", async () => {
    const g = await gallery();
    const code = async (p: Promise<unknown>) =>
      p.then(
        () => "ok",
        (e: DeliveryError) => e.code,
      );
    expect(
      await code(sendDeliveryMail(deps(), form(g.id, { recipients: "" }))),
    ).toBe("no_recipients");
    expect(
      await code(
        sendDeliveryMail(deps(), form(g.id, { recipients: "kein-mail" })),
      ),
    ).toBe("invalid");
    expect(
      await code(sendDeliveryMail(deps(), form(g.id, { subject: " " }))),
    ).toBe("invalid");
    expect(
      await code(
        sendDeliveryMail(
          deps(),
          form(g.id, {
            recipients: Array.from({ length: 21 }, (_, i) => `u${i}@x.de`).join(
              " ",
            ),
          }),
        ),
      ),
    ).toBe("invalid");
    expect(
      await code(
        sendDeliveryMail({ ...deps(), accountId: otherId }, form(g.id)),
      ),
    ).toBe("not_found");
    const draft = await tenantDb(db, accountId).galleries.create({
      slug: "d",
      title: "D",
    });
    expect(await code(sendDeliveryMail(deps(), form(draft.id)))).toBe(
      "not_published",
    );
    expect(mailer.outbox).toHaveLength(0);
  });

  it("lists the log per tenant only", async () => {
    const g = await gallery();
    await sendDeliveryMail(deps(), form(g.id));
    expect(await listDeliveries(db, otherId, g.id)).toHaveLength(0);
  });
});
