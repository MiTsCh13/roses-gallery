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

test("legal placeholder pages are public and linked from the home page", async ({
  page,
}) => {
  await page.goto("/");
  for (const [link, title] of [
    [messages.Legal.impressum.linkLabel, messages.Legal.impressum.title],
    [messages.Legal.datenschutz.linkLabel, messages.Legal.datenschutz.title],
    [messages.Legal.agb.linkLabel, messages.Legal.agb.title],
  ] as const) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Entwurf");
    await page.goBack();
  }
});
