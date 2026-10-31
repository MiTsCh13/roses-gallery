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

test("library: folders, upload into a folder, move and delete", async ({
  page,
  request,
}, testInfo) => {
  await signUp(
    page,
    request,
    `library+${testInfo.project.name}-${Date.now()}@foto-rose.de`,
  );
  page.on("dialog", (d) => void d.accept());

  await page.getByRole("link", { name: "Bibliothek" }).click();
  await expect(page.getByText("Hier ist noch nichts.")).toBeVisible();

  await page.getByLabel("Ordnername").fill("Trauung");
  await page.getByRole("button", { name: "Neuer Ordner" }).click();
  await page
    .getByTestId("folder-list")
    .getByRole("link", { name: /Trauung/ })
    .click();
  await expect(page).toHaveURL(/folder=/);

  await page.getByTestId("file-input").setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(1024, 1) },
    { name: "x.gif", mimeType: "image/gif", buffer: Buffer.alloc(10) },
  ]);
  const list = page.getByTestId("upload-list");
  await expect(list.locator('[data-state="done"]')).toHaveCount(1);
  await expect(list.locator('[data-state="error"]')).toContainText(
    "Dateityp wird nicht unterstützt",
  );
  // Without a worker the photo stays in "wird verarbeitet".
  const grid = page.getByTestId("media-grid");
  await expect(grid.locator("li")).toHaveCount(1);

  // Move to the root: it disappears from the folder, shows up in the root.
  await grid.getByRole("checkbox").check();
  await page.getByLabel("Verschieben nach …").selectOption("root");
  await expect(page.getByText("Hier ist noch nichts.")).toBeVisible();
  await page
    .getByRole("link", { name: "Bibliothek", exact: true })
    .last()
    .click();
  await expect(page.getByTestId("media-grid").locator("li")).toHaveCount(1);

  // Delete it for good.
  await page.getByTestId("media-grid").getByRole("checkbox").check();
  await page
    .getByTestId("selection-bar")
    .getByRole("button", { name: "Löschen" })
    .click();
  await expect(page.getByTestId("media-grid")).toHaveCount(0);

  // Deleting the folder works too.
  await page.getByRole("button", { name: "Ordner löschen" }).click();
  await expect(page.getByTestId("folder-list")).toHaveCount(0);
});
