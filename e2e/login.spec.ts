import { expect, test } from "@playwright/test";

test("magic-link flow: register, land on dashboard, sign out", async ({
  page,
  request,
}, testInfo) => {
  const email = `anna+${testInfo.project.name}-${Date.now()}@foto-rose.de`;

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/\/login\/check-email/);

  const res = await request.get(
    `/api/test/mailbox?to=${encodeURIComponent(email)}`,
  );
  expect(res.ok()).toBe(true);
  const { text } = await res.json();
  const link = text.match(/https?:\/\/\S+/)![0];

  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("signed-in-as")).toContainText(email);

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("rejects an invalid e-mail address", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill("kein-email");
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page.locator("#email-error")).toContainText(
    "gültige E-Mail-Adresse",
  );
});
