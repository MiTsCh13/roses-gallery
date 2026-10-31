import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { totpCode } from "../src/lib/totp";

async function signIn(page: Page, request: APIRequestContext, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/\/login\/check-email/);
  const res = await request.get(
    `/api/test/mailbox?to=${encodeURIComponent(email)}`,
  );
  const { text } = await res.json();
  await page.goto(text.match(/https?:\/\/\S+/)![0]);
}

test("2FA: set up, challenge at sign-in, recovery code, disable", async ({
  page,
  request,
}, testInfo) => {
  const email = `tfa+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await signIn(page, request, email);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/settings/security");
  await page.getByRole("button", { name: "2FA einrichten" }).click();
  const secret = (await page.getByTestId("totp-secret").textContent())!;
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "2FA aktivieren" }).click();
  await expect(page.locator("#code-error")).toContainText("ungültig");
  await page.getByLabel("Code").fill(totpCode(secret, Date.now()));
  await page.getByRole("button", { name: "2FA aktivieren" }).click();
  const items = page.getByTestId("recovery-codes").locator("li");
  await expect(items).toHaveCount(8);
  const codes = await items.allTextContents();

  // The session that enabled 2FA stays usable.
  await page.goto("/dashboard");
  await expect(page.getByTestId("signed-in-as")).toBeVisible();

  // New sign-in is challenged; the dashboard stays closed until the code is right.
  await page.getByRole("button", { name: "Abmelden" }).click();
  await signIn(page, request, email);
  await expect(page).toHaveURL(/\/login\/2fa/);
  await page.goto("/dashboard/galleries");
  await expect(page).toHaveURL(/\/login\/2fa/);
  const api = await page.request.post("/api/uploads/start", { data: {} });
  expect(api.status()).toBe(401);

  await page.getByLabel("Code").fill("123456");
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.locator("#code-error")).toContainText("ungültig");
  await page.getByLabel("Code").fill(codes[0]);
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Disable with a fresh TOTP step (the setup step is already consumed).
  await page.goto("/dashboard/settings/security");
  await expect(page.getByTestId("two-factor-state")).toBeVisible();
  await page.getByLabel("Code").fill(totpCode(secret, Date.now() + 30_000));
  await page.getByRole("button", { name: "2FA deaktivieren" }).click();
  await expect(
    page.getByRole("button", { name: "2FA einrichten" }),
  ).toBeVisible();
});
