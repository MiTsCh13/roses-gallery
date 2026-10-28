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
  const slug = await page
    .getByRole("textbox", { name: "Adresse (Slug)" })
    .inputValue();
  await page.getByRole("textbox", { name: "Titel des Sets" }).fill("Trauung");
  await page.getByRole("button", { name: "Set hinzufügen" }).click();
  await expect(page.getByTestId("set-list").locator("li")).toHaveCount(1);

  // not-found is rendered inside the streamed shell, so assert on content
  const draft = await request.get(`/g/${slug}`);
  expect(await draft.text()).not.toContain("Trauung");
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
  await expect(visitor.getByRole("heading", { name: "Trauung" })).toBeVisible();
  await anon.close();
});
