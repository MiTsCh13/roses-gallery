import { describe, expect, it, vi } from "vitest";

import { FakeMailer, PostmarkMailer } from "./mailer";

describe("FakeMailer", () => {
  it("collects mails and finds the latest per recipient case-insensitively", async () => {
    const mailer = new FakeMailer();
    await mailer.send({ to: "a@x.de", subject: "1", text: "eins" });
    await mailer.send({ to: "A@x.de", subject: "2", text: "zwei" });
    expect(mailer.lastTo("a@X.de")?.text).toBe("zwei");
    expect(mailer.lastTo("b@x.de")).toBeUndefined();
  });
});

describe("PostmarkMailer", () => {
  it("posts to Postmark with the server token", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const mailer = new PostmarkMailer("tok", "Rose <hi@rose.de>", fetchMock);
    await mailer.send({ to: "a@x.de", subject: "S", text: "T" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.postmarkapp.com/email");
    expect(
      (init.headers as Record<string, string>)["X-Postmark-Server-Token"],
    ).toBe("tok");
    expect(JSON.parse(init.body as string)).toMatchObject({
      From: "Rose <hi@rose.de>",
      To: "a@x.de",
      Subject: "S",
      TextBody: "T",
    });
  });

  it("throws when Postmark rejects the request", async () => {
    const mailer = new PostmarkMailer(
      "tok",
      "hi@rose.de",
      async () => new Response("no", { status: 401 }),
    );
    await expect(
      mailer.send({ to: "a@x.de", subject: "S", text: "T" }),
    ).rejects.toThrow(/401/);
  });
});
