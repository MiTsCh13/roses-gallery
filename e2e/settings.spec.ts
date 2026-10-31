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

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("profile & settings: tabs, profile data and logo", async ({
  page,
  request,
}, testInfo) => {
  const email = `prof+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await signUp(page, request, email);

  await page
    .getByRole("link", { name: "Profil & Einstellungen" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Profil & Einstellungen" }),
  ).toBeVisible();

  await page.getByLabel("Studioname").fill("Foto Rose");
  await page.getByLabel("Ansprechpartner").fill("Anna Rose");
  await page.getByLabel("Webseite").fill("https://foto-rose.de");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");
  await expect(page.getByLabel("Studioname")).toHaveValue("Foto Rose");
  await expect(page.getByLabel("Ansprechpartner")).toHaveValue("Anna Rose");

  await page.getByLabel("Logo-Datei").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("button", { name: "Logo hochladen" }).click();
  await expect(page.getByRole("img", { name: "Aktuelles Logo" })).toBeVisible();
  await page.getByRole("button", { name: "Logo entfernen" }).click();
  await expect(page.getByRole("img", { name: "Aktuelles Logo" })).toHaveCount(
    0,
  );

  await page.getByRole("link", { name: "Abo & Speicher" }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings\/billing/);
  await page.getByRole("link", { name: "Sicherheit" }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings\/security/);
});

test("password: set in profile, then sign in with e-mail and password", async ({
  page,
  request,
}, testInfo) => {
  const email = `pw+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await signUp(page, request, email);

  await page.goto("/dashboard/settings");
  await page.getByLabel("Neues Passwort (mind. 8 Zeichen)").fill("geheim1234");
  await page.getByLabel("Neues Passwort wiederholen").fill("geheim1234");
  await page.getByRole("button", { name: "Passwort festlegen" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");
  await expect(page.getByLabel("Aktuelles Passwort")).toBeVisible();

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByText("Mit Passwort anmelden").click();
  await page.locator("#pw-email").fill(email);
  await page.locator("#pw-password").fill("falsch-falsch");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.locator("#pw-error")).toContainText("stimmen nicht");

  // React resets the form after a submitted action.
  await page.locator("#pw-email").fill(email);
  await page.locator("#pw-password").fill("geheim1234");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("signed-in-as")).toContainText(email);
});
