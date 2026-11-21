import { expect, test } from "@playwright/test";

test("the info text under the title is saved and shown publicly", async ({
  page,
  request,
}, testInfo) => {
  const email = `info+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/check-email/);
  const { text } = await (
    await request.get(`/api/test/mailbox?to=${encodeURIComponent(email)}`)
  ).json();
  await page.goto(text.match(/https?:\/\/\S+/)![0]);
  await page.goto("/dashboard/galleries/new");
  await page.getByLabel("Titel").fill("Info-Test");
  await page.getByRole("button", { name: "Galerie anlegen" }).click();
  await expect(page).toHaveURL(/galleries\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");
  await page.locator("input[name=description]").fill("Hochzeit am See");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("status").first()).toBeVisible();
  await page.reload();
  await expect(page.locator("input[name=description]")).toHaveValue(
    "Hochzeit am See",
  );

  // published: visitors see it under the title
  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("status").first()).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Vorschau im neuen Tab" })
    .getAttribute("href");
  await page.goto(href!);
  await expect(page.getByText("Hochzeit am See")).toBeVisible();
});
