import { expect, test, type Page } from "@playwright/test";

async function save(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/galleries/"),
    ),
    page.getByRole("button", { name: "Speichern", exact: true }).click(),
  ]);
}

// Favoriten eines Besuchers erscheinen im Galerie-Editor und als CSV.
// (Videos werden über den Fake-Provider fertig, Fotos bräuchten den Worker.)
test("gallery editor shows visitor favorites and exports them as CSV", async ({
  page,
  browser,
  request,
}, testInfo) => {
  const email = `favs+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/check-email/);
  const { text } = await (
    await request.get(`/api/test/mailbox?to=${encodeURIComponent(email)}`)
  ).json();
  await page.goto(text.match(/https?:\/\/\S+/)![0]);
  await page.goto("/dashboard/galleries/new");
  await page.getByLabel("Titel").fill("Favoriten-Test");
  await page.getByRole("button", { name: "Galerie anlegen" }).click();
  await expect(page).toHaveURL(/galleries\/[0-9a-f-]{36}$/);
  const editorUrl = page.url();
  const galleryId = editorUrl.split("/").pop()!;
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#favorites-block")).toContainText(
    "Noch hat niemand Favoriten markiert.",
  );

  await page.getByTestId("gallery-file-input").setInputFiles({
    name: "film.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(1024 * 1024, 4),
  });
  const item = page.getByTestId("gallery-media").locator("li");
  await expect(item).toHaveCount(1);
  const mediaId = await item.first().getAttribute("data-media-id");
  expect(
    (
      await page.request.post("/api/test/video-ready", { data: { mediaId } })
    ).ok(),
  ).toBe(true);

  // die Bibliothek zieht den Status vom (Fake-)Provider nach
  await page.goto("/dashboard/library");
  await expect(
    page.getByTestId("media-grid").locator("li").first(),
  ).toHaveAttribute("data-status", "ready");
  await page.goto(editorUrl);
  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await save(page);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue(
    "published",
  );
  const href = await page
    .getByRole("link", { name: "Vorschau im neuen Tab" })
    .getAttribute("href");

  // Ein Gast markiert das Video (eigener Browser-Kontext = eigener Besucher).
  const guest = await browser.newContext();
  const visitor = await guest.newPage();
  await visitor.goto(href!);
  await visitor
    .getByRole("button", { name: "Zu Favoriten hinzufügen" })
    .first()
    .click();
  await expect(
    visitor.getByRole("button", { name: "Aus Favoriten entfernen" }).first(),
  ).toBeVisible();
  await guest.close();

  await page.goto(editorUrl);
  const lists = page.getByTestId("favorite-lists");
  await expect(lists).toContainText("Favoriten");
  await expect(lists).toContainText("Gast ohne E-Mail");
  await expect(lists).toContainText("Videos: 1");

  const csv = await page.request.get(`/api/galleries/${galleryId}/favorites`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain('"Favoriten";"Gast";"Video";"1"');
  // ohne Anmeldung kein Export
  expect(
    (await request.get(`/api/galleries/${galleryId}/favorites`)).status(),
  ).toBe(401);
});

// D-163: Kund:innen laden das Original eines Videos, wenn die Galerie
// Downloads im Original erlaubt.
test("visitors download a video original when the gallery allows originals", async ({
  page,
  browser,
  request,
}, testInfo) => {
  const email = `viddl+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/check-email/);
  const { text } = await (
    await request.get(`/api/test/mailbox?to=${encodeURIComponent(email)}`)
  ).json();
  await page.goto(text.match(/https?:\/\/\S+/)![0]);
  await page.goto("/dashboard/galleries/new");
  await page.getByLabel("Titel").fill("Film-Download");
  await page.getByRole("button", { name: "Galerie anlegen" }).click();
  await expect(page).toHaveURL(/galleries\/[0-9a-f-]{36}$/);
  const editorUrl = page.url();
  await page.waitForLoadState("networkidle");

  await page.getByTestId("gallery-file-input").setInputFiles({
    name: "film.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(1024 * 1024, 4),
  });
  const item = page.getByTestId("gallery-media").locator("li");
  await expect(item).toHaveCount(1);
  const mediaId = await item.first().getAttribute("data-media-id");
  expect(
    (
      await page.request.post("/api/test/video-ready", { data: { mediaId } })
    ).ok(),
  ).toBe(true);
  await page.goto("/dashboard/library");
  await expect(
    page.getByTestId("media-grid").locator("li").first(),
  ).toHaveAttribute("data-status", "ready");

  await page.goto(editorUrl);
  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await page
    .getByRole("combobox", { name: "Downloads für diese Galerie" })
    .selectOption("original");
  await save(page);
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Downloads für diese Galerie" }),
  ).toHaveValue("original");
  const href = await page
    .getByRole("link", { name: "Vorschau im neuen Tab" })
    .getAttribute("href");

  const guest = await browser.newContext();
  const visitor = await guest.newPage();
  await visitor.goto(href!);
  await visitor.getByTestId("video-tile").first().click();
  const link = visitor.getByRole("link", { name: "Original herunterladen" });
  await expect(link).toBeVisible();
  const res = await visitor.request.get((await link.getAttribute("href"))!, {
    maxRedirects: 0,
  });
  expect(res.status()).toBe(302);
  expect(res.headers().location).toContain(`/api/test/original/`);
  await guest.close();
});
