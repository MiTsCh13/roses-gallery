import { expect, test } from "@playwright/test";

test("public gallery is only visible once published", async ({
  page,
  request,
}, testInfo) => {
  const email = `pub+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/\/login\/check-email/);
  const { text } = await (
    await request.get(`/api/test/mailbox?to=${encodeURIComponent(email)}`)
  ).json();
  await page.goto(text.match(/https?:\/\/\S+/)![0]);
  await expect(page).toHaveURL(/\/dashboard/);

  const title = `Öffentlich ${testInfo.project.name} ${Date.now()}`;
  await page.goto("/dashboard/galleries/new");
  await page.getByLabel("Titel").fill(title);
  await page.getByRole("button", { name: "Galerie anlegen" }).click();
  await expect(page).toHaveURL(/\/dashboard\/galleries\/[0-9a-f-]{36}$/);
  const slug = (
    (await page
      .getByRole("link", { name: "Vorschau im neuen Tab" })
      .getAttribute("href")) ?? ""
  ).replace("/g/", "");

  // not-found is rendered inside the streamed shell, so assert on content
  const draft = await request.get(`/g/${slug}`);
  expect(await draft.text()).not.toContain(title);
  expect(await draft.text()).not.toContain('data-testid="gallery-view"');

  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");

  // anonymous visitor: a fresh context without the session cookie
  const res = await request.get(`/g/${slug}`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/<meta name="robots" content="noindex/);
  const anon = await page.context().browser()!.newContext();
  const visitor = await anon.newPage();
  await visitor.goto(`/g/${slug}`);
  await expect(visitor.getByTestId("gallery-view")).toBeVisible();
  await expect(visitor.getByRole("heading", { name: title })).toBeVisible();
  await anon.close();
});

test("password-protected gallery asks for the password and stays open with the cookie", async ({
  page,
  request,
}, testInfo) => {
  const email = `pw+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
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
  await page
    .getByLabel("Titel")
    .fill(`Geschützt ${testInfo.project.name} ${Date.now()}`);
  await page.getByRole("button", { name: "Galerie anlegen" }).click();
  await expect(page).toHaveURL(/\/dashboard\/galleries\/[0-9a-f-]{36}$/);
  const slug = (
    (await page
      .getByRole("link", { name: "Vorschau im neuen Tab" })
      .getAttribute("href")) ?? ""
  ).replace("/g/", "");
  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");

  await page
    .getByRole("textbox", { name: "Neues Passwort (mind. 6 Zeichen)" })
    .fill("geheim-123");
  await page.getByRole("button", { name: "Passwort setzen" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");
  await expect(
    page.getByText("Die Galerie ist durch ein Passwort geschützt."),
  ).toBeVisible();

  const ip = () =>
    `10.${Math.floor(Math.random() * 250)}.${Date.now() % 250}.${Math.floor(Math.random() * 250)}`;
  const anon = await page
    .context()
    .browser()!
    .newContext({
      extraHTTPHeaders: { "x-forwarded-for": ip() },
    });
  const visitor = await anon.newPage();
  await visitor.goto(`/g/${slug}`);
  await expect(visitor.getByTestId("gallery-view")).toHaveCount(0);

  await visitor.getByLabel("Passwort").fill("falsch-123");
  await visitor.getByRole("button", { name: "Galerie öffnen" }).click();
  await expect(visitor.locator("p[role=alert]")).toHaveText(
    "Das Passwort stimmt nicht.",
  );

  await visitor.getByLabel("Passwort").fill("geheim-123");
  await visitor.getByRole("button", { name: "Galerie öffnen" }).click();
  await expect(visitor.getByTestId("gallery-view")).toBeVisible();
  // the cookie keeps the gallery open on reload
  await visitor.reload();
  await expect(visitor.getByTestId("gallery-view")).toBeVisible();

  await anon.close();
});
