import { expect, test, type Page } from "@playwright/test";

// Speichern per Server Action: auf die POST-Antwort warten statt auf eine
// Statusmeldung (die Seite hat mehrere role=status-Elemente).
async function save(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/galleries/"),
    ),
    page.getByRole("button", { name: "Speichern", exact: true }).click(),
  ]);
}

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
  await save(page);
  await page.reload();
  await expect(page.locator("input[name=description]")).toHaveValue(
    "Hochzeit am See",
  );

  // published: visitors see it under the title
  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await save(page);
  // Erst weiter, wenn der Status wirklich gespeichert ist (sonst 404-Race).
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue(
    "published",
  );
  const href = await page
    .getByRole("link", { name: "Vorschau im neuen Tab" })
    .getAttribute("href");
  await page.goto(href!);
  await expect(page.getByText("Hochzeit am See")).toBeVisible();
});
