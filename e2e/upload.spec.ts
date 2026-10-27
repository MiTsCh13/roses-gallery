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

test("uploads photos (single and multipart) and lists them as processing", async ({
  page,
  request,
}, testInfo) => {
  await signUp(
    page,
    request,
    `upload+${testInfo.project.name}-${Date.now()}@foto-rose.de`,
  );
  const seed = await page.request.post("/api/test/seed-set");
  expect(seed.ok()).toBe(true);
  const { setId } = await seed.json();

  await page.goto(`/dashboard/sets/${setId}`);
  await expect(page.getByText("Noch keine Fotos")).toBeVisible();

  await page.getByTestId("file-input").setInputFiles([
    {
      name: "klein.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(1024, 1),
    },
    {
      // > 8 MiB part size → two parts
      name: "gross.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(9 * 1024 * 1024, 2),
    },
    { name: "film.gif", mimeType: "image/gif", buffer: Buffer.alloc(10) },
  ]);

  const list = page.getByTestId("upload-list");
  await expect(list.locator('[data-state="done"]')).toHaveCount(2);
  await expect(list.locator('[data-state="error"]')).toContainText(
    "Dateityp wird nicht unterstützt",
  );

  // Without a running worker the photos stay in "wird verarbeitet".
  const photos = page.getByTestId("photo-list").locator("li");
  await expect(photos).toHaveCount(2);
  await expect(photos.first()).toContainText("wird verarbeitet");
  await expect(page.getByText("2 Fotos")).toBeVisible();
});

test("another account cannot open the set", async ({
  page,
  request,
}, testInfo) => {
  await signUp(
    page,
    request,
    `owner+${testInfo.project.name}-${Date.now()}@foto-rose.de`,
  );
  const { setId } = await (
    await page.request.post("/api/test/seed-set")
  ).json();
  await page.context().clearCookies();
  await signUp(
    page,
    request,
    `other+${testInfo.project.name}-${Date.now()}@foto-rose.de`,
  );
  // The page streams, so the status is already 200: check the content.
  await page.goto(`/dashboard/sets/${setId}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByTestId("dropzone")).toHaveCount(0);
});
