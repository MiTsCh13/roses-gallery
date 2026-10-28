import { expect, test } from "@playwright/test";

test("switch theme and viewport in the design editor, then persist", async ({
  page,
  request,
}, testInfo) => {
  const email = `design+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/\/login\/check-email/);
  const { text } = await (
    await request.get(`/api/test/mailbox?to=${encodeURIComponent(email)}`)
  ).json();
  await page.goto(text.match(/https?:\/\/\S+/)![0]);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/galleries/new");
  await page.getByLabel("Titel").fill("Design-Test");
  await page.getByRole("button", { name: "Galerie anlegen" }).click();
  await expect(page).toHaveURL(/\/dashboard\/galleries\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "Design" }).click();
  await expect(page).toHaveURL(/\/design$/);

  const view = page.getByTestId("gallery-view");
  await expect(view).toHaveAttribute("data-layout", "uniform");
  await page.getByLabel("Theme").selectOption({ label: "Dunkel" });
  await expect(view).toHaveAttribute("data-layout", "rows");
  await expect(view).toHaveAttribute("data-cover", "minimal");

  await page.getByRole("button", { name: "Mobil" }).click();
  await expect(page.getByTestId("design-preview")).toHaveAttribute(
    "data-viewport",
    "mobile",
  );

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await expect(page.getByTestId("gallery-logo")).toHaveCount(0);
  await page
    .getByLabel("Logo-Datei")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Logo hochladen" }).click();
  await expect(page.getByTestId("gallery-logo")).toBeVisible();
  await page.getByLabel("Theme").selectOption({ label: "Dunkel" });

  await page.getByRole("button", { name: "Design speichern" }).click();
  await expect(page.getByText("Design gespeichert.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("gallery-view")).toHaveAttribute(
    "data-layout",
    "rows",
  );
});
