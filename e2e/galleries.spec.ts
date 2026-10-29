import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

async function signUp(page: Page, request: APIRequestContext, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/\/login\/check-email/);
  const res = await request.get(
    `/api/test/mailbox?to=${encodeURIComponent(email)}`,
  );
  const { text } = await res.json();
  await page.goto(text.match(/https?:\/\/\S+/)![0]);
  await expect(page).toHaveURL(/\/dashboard/);
}

test("create a gallery, edit it and add photo and video sets", async ({
  page,
  request,
}, testInfo) => {
  await signUp(
    page,
    request,
    `gal+${testInfo.project.name}-${Date.now()}@foto-rose.de`,
  );

  await page.goto("/dashboard/galleries");
  await expect(page.getByText("Noch keine Galerie angelegt.")).toBeVisible();
  await page.getByRole("link", { name: "Neue Galerie" }).click();
  await page.getByLabel("Titel").fill("Anna & Jörg");
  await page.getByLabel("Ablaufdatum").fill("2027-05-01");
  await page.getByRole("button", { name: "Galerie anlegen" }).click();

  await expect(page).toHaveURL(/\/dashboard\/galleries\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Anna & Jörg" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Adresse (Slug)" }),
  ).toHaveValue(/^anna-joerg(-\d+)?$/);

  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");

  // Delivery mail: edited text, placeholders filled, logged.
  const client = `kunde+${testInfo.project.name}-${Date.now()}@example.com`;
  await page.getByLabel(/^Empfänger/).fill(client);
  await page.locator("textarea[name=body]").fill("Schau mal: {link}");
  await page.getByRole("button", { name: "Mail senden" }).click();
  await expect(page.getByRole("status")).toHaveText("1 Mail gesendet.");
  await expect(page.getByTestId("delivery-log")).toContainText(client);
  const mailRes = await request.get(
    `/api/test/mailbox?to=${encodeURIComponent(client)}`,
  );
  const mail = await mailRes.json();
  expect(mail.subject).toBe("Deine Galerie „Anna & Jörg“ ist fertig");
  expect(mail.text).toMatch(/Schau mal: https?:\/\/\S+\/g\/anna-joerg/);

  await page.getByRole("textbox", { name: "Titel des Sets" }).fill("Trauung");
  await page.getByRole("button", { name: "Set hinzufügen" }).click();
  await expect(page.getByTestId("set-list").locator("li")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Titel des Sets" }).fill("Film");
  await page
    .getByRole("combobox", { name: "Art des Sets" })
    .selectOption("video");
  await page.getByRole("button", { name: "Set hinzufügen" }).click();
  await expect(page.getByTestId("set-list").locator("li")).toHaveText([
    /Trauung.*Fotos/,
    /Film.*Videos/,
  ]);

  // Reorder: move "Film" above "Trauung"; the order survives a reload.
  const saved = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/galleries/"),
  );
  await page.getByRole("button", { name: "Nach oben: Film" }).click();
  await saved;
  await expect(page.getByTestId("set-list").locator("li")).toHaveText([
    /Film/,
    /Trauung/,
  ]);
  await page.reload();
  await expect(page.getByTestId("set-list").locator("li")).toHaveText([
    /Film/,
    /Trauung/,
  ]);

  await page.getByRole("link", { name: "← Alle Galerien" }).click();
  await expect(page.getByTestId("gallery-list")).toContainText(
    "Veröffentlicht",
  );
  await expect(page.getByTestId("gallery-list")).toContainText(
    "Ablauf: 1.5.2027",
  );
});
