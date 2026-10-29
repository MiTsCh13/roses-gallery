import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function violations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return result.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));
}

test("public gallery has no WCAG 2.1 AA violations", async ({
  page,
  request,
}, testInfo) => {
  const email = `a11y+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
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
    .fill(`A11y ${testInfo.project.name} ${Date.now()}`);
  await page.getByRole("button", { name: "Galerie anlegen" }).click();
  await expect(page).toHaveURL(/\/dashboard\/galleries\/[0-9a-f-]{36}$/);
  const slug = await page
    .getByRole("textbox", { name: "Adresse (Slug)" })
    .inputValue();
  await page.getByRole("textbox", { name: "Titel des Sets" }).fill("Trauung");
  await page.getByRole("button", { name: "Set hinzufügen" }).click();
  await expect(page.getByTestId("set-list").locator("li")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");

  const anon = await page.context().browser()!.newContext();
  const visitor = await anon.newPage();
  await visitor.goto(`/g/${slug}`);
  await expect(visitor.getByTestId("gallery-view")).toBeVisible();
  expect(await violations(visitor)).toEqual([]);
  await anon.close();

  await page
    .getByRole("textbox", { name: "Neues Passwort (mind. 6 Zeichen)" })
    .fill("geheim-123");
  await page.getByRole("button", { name: "Passwort setzen" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");
  const gate = await page.context().browser()!.newContext();
  const gatePage = await gate.newPage();
  await gatePage.goto(`/g/${slug}`);
  await expect(gatePage.getByLabel("Passwort")).toBeVisible();
  expect(await violations(gatePage)).toEqual([]);
  await gate.close();
});

test("login and landing page have no WCAG 2.1 AA violations", async ({
  page,
}) => {
  for (const path of ["/", "/login", "/impressum"]) {
    await page.goto(path);
    expect(await violations(page), path).toEqual([]);
  }
});
