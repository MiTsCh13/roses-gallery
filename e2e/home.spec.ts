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
