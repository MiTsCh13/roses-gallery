import { expect, test } from "@playwright/test";

import messages from "../messages/de.json";

test("home page renders German copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    page.getByRole("heading", { level: 1, name: messages.HomePage.title }),
  ).toBeVisible();
  await expect(page.getByText(messages.HomePage.tagline)).toBeVisible();
});

test("responses carry security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("legal pages are public and linked from the footer", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", {
    name: messages.Marketing.footer.label,
  });
  for (const [link, title] of [
    [messages.Legal.impressum.linkLabel, messages.Legal.impressum.title],
    [messages.Legal.datenschutz.linkLabel, messages.Legal.datenschutz.title],
    [messages.Legal.agb.linkLabel, messages.Legal.agb.title],
  ] as const) {
    await footer.getByRole("link", { name: link, exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Entwurf");
    // Kopf und Fuß gibt es auch auf den Rechtsseiten.
    await expect(
      page.getByRole("link", { name: messages.Marketing.brand, exact: true }),
    ).toBeVisible();
    await page.goBack();
  }

  // Ohne LEGAL_VAT_ID entfällt der USt-ID-Abschnitt (keine USt-ID vorhanden).
  await page.goto("/impressum");
  await expect(page.getByText("Umsatzsteuer")).toHaveCount(0);
  // Österreichisches Recht (D-166): ECG/MedienG statt DDG; ohne LEGAL_TRADE
  // entfallen die gewerberechtlichen Angaben.
  await expect(
    page.getByRole("heading", { name: /§ 5 ECG.*§ 25 MedienG/ }),
  ).toBeVisible();
  await expect(page.getByText("DDG")).toHaveCount(0);
  await expect(page.getByText("Gewerberechtliche Angaben")).toHaveCount(0);
});

test("website navigation works on desktop and mobile", async ({
  page,
  isMobile,
}) => {
  const nav = messages.Marketing.nav;
  await page.goto("/impressum");
  const open = async () => {
    if (isMobile) {
      await page.getByText(nav.menu, { exact: true }).click();
      return page.getByRole("navigation", { name: nav.mobileLabel });
    }
    return page.locator("header");
  };

  let menu = await open();
  await menu.getByRole("link", { name: nav.features, exact: true }).click();
  await expect(page).toHaveURL(/\/#funktionen$/);
  await expect(page.locator("#funktionen")).toBeInViewport();
  if (isMobile) {
    await expect(
      page.getByRole("navigation", { name: nav.mobileLabel }),
    ).toBeHidden();
  }

  menu = await open();
  await menu.getByRole("link", { name: nav.signIn, exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  menu = await open();
  await menu.getByRole("link", { name: nav.start, exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await page
    .getByRole("main")
    .getByRole("link", { name: messages.HomePage.cta })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test("all website links resolve", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page
    .locator("header a, footer a, main a")
    .evaluateAll((links) =>
      links
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => href.startsWith("/")),
    );
  expect(hrefs.length).toBeGreaterThan(3);
  for (const href of new Set(hrefs)) {
    const response = await request.get(href.split("#")[0]);
    expect(response.status(), href).toBe(200);
  }
});

test("landing page shows features, steps and a working FAQ", async ({
  page,
}) => {
  const home = messages.HomePage;
  await page.goto("/");
  for (const feature of home.features) {
    await expect(
      page.getByRole("heading", { level: 3, name: feature.title }),
    ).toBeVisible();
  }
  for (const step of home.steps) {
    await expect(
      page.getByRole("heading", { level: 3, name: step.title }),
    ).toBeVisible();
  }
  const first = home.faq[0];
  await expect(page.getByText(first.a)).toBeHidden();
  await page.getByText(first.q).click();
  await expect(page.getByText(first.a)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: home.closingTitle }),
  ).toBeVisible();
});

test("pricing page is linked and toggles yearly billing", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByText(messages.Marketing.nav.menu, { exact: true }).click();
    await page
      .getByRole("navigation", { name: messages.Marketing.nav.mobileLabel })
      .getByRole("link", { name: messages.Marketing.nav.pricing })
      .click();
  } else {
    await page
      .locator("header")
      .getByRole("link", { name: messages.Marketing.nav.pricing })
      .click();
  }
  await expect(page).toHaveURL(/\/preise$/);
  await expect(
    page.getByRole("heading", { level: 1, name: messages.Pricing.title }),
  ).toBeVisible();
  const bud = page.getByTestId("plan-bud").getByTestId("price");
  await expect(bud).toContainText(messages.Pricing.perMonth);
  await page.getByRole("button", { name: /Jährlich/ }).click();
  await expect(bud).toContainText(messages.Pricing.perYear);
});

test("blog lists no drafts in production and serves RSS", async ({
  page,
  request,
}) => {
  await page.goto("/blog");
  await expect(
    page.getByRole("heading", { level: 1, name: messages.Blog.title }),
  ).toBeVisible();
  // Entwürfe (D-153) erscheinen nicht, freigegebene Beiträge schon.
  await expect(page.getByText(messages.Blog.draft)).toHaveCount(0);
  await page
    .getByRole("link", { name: /Galerie-Link statt Dropbox/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/blog\/galerie-link-statt-dropbox$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Galerie-Link statt Dropbox/ }),
  ).toBeVisible();
  await expect(page.getByText("Gib das Passwort mit")).toBeVisible();

  // notFound kommt im gestreamten Shell (HTTP 200), daher Inhalt prüfen.
  await page.goto("/blog/hochzeitsvideos-ohne-qualitaetsverlust-ausliefern");
  await expect(
    page.getByRole("heading", { name: "This page could not be found." }),
  ).toBeVisible();

  const rss = await request.get("/blog/rss.xml");
  expect(rss.status()).toBe(200);
  expect(rss.headers()["content-type"]).toContain("application/rss+xml");
  const xml = await rss.text();
  expect(xml).toContain('<rss version="2.0"');
  expect(xml).toMatch(/<link>https?:\/\/[^<]+\/blog<\/link>/);
  expect(xml).not.toContain("hochzeitsvideos-ohne-qualitaetsverlust");
  expect(xml).toContain("/blog/galerie-link-statt-dropbox</link>");
});

test("contact form: linked from the footer, validates and mails the message", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: messages.Marketing.footer.label })
    .getByRole("link", { name: messages.Marketing.footer.contact })
    .click();
  await expect(page).toHaveURL(/\/kontakt$/);
  await expect(
    page.getByRole("heading", { level: 1, name: messages.Contact.title }),
  ).toBeVisible();

  const email = `kontakt+${Date.now()}@foto-rose.de`;
  await page.getByLabel(messages.Contact.name).fill("Anna Test");
  await page.getByLabel(messages.Contact.email).fill(email);
  await page.getByLabel(messages.Contact.message).fill("kurz");
  await page.getByRole("button", { name: messages.Contact.send }).click();
  await expect(page.locator("#contact-error")).toHaveText(
    messages.Contact.errors.invalid,
  );

  await page.getByLabel(messages.Contact.name).fill("Anna Test");
  await page.getByLabel(messages.Contact.email).fill(email);
  await page
    .getByLabel(messages.Contact.message)
    .fill(`Hallo, eine Frage zur Beta (${email}).`);
  await page.getByRole("button", { name: messages.Contact.send }).click();
  await expect(page.getByTestId("contact-sent")).toBeVisible();

  const mail = await (
    await request.get("/api/test/mailbox?to=kontakt%40e2e.test")
  ).json();
  expect(mail.subject).toBe("Kontaktformular: Anna Test");
  expect(mail.replyTo).toBe(email);
  expect(mail.text).toContain(email);
});
