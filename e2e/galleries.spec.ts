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

test("create a gallery, edit it and add library media", async ({
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
    page.getByRole("link", { name: "Galerie ansehen" }),
  ).toHaveAttribute("href", /^\/g\/anna-joerg(-\d+)?$/);

  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("published");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toHaveText("Gespeichert.");

  // Delivery mail: edited text, placeholders filled, logged.
  const client = `kunde+${testInfo.project.name}-${Date.now()}@example.com`;
  await page.getByRole("button", { name: "An Kunden senden" }).click();
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

  // Media come from the library: upload a video there, let the (fake) provider
  // finish it, then add it to the gallery. (Photos need the worker to be ready.)
  const galleryUrl = page.url();
  await page.goto("/dashboard/library", { waitUntil: "networkidle" });
  await page.getByTestId("file-input").setInputFiles({
    name: "trauung.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(2 * 1024 * 1024, 7),
  });
  await expect(
    page.getByTestId("upload-list").locator('[data-state="done"]'),
  ).toHaveCount(1);
  const mediaId = await page
    .getByTestId("media-grid")
    .locator("li")
    .first()
    .getAttribute("data-id");
  expect(
    (
      await page.request.post("/api/test/video-ready", { data: { mediaId } })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByTestId("media-grid").locator("li").first(),
  ).toHaveAttribute("data-status", "ready");

  await page.goto(galleryUrl);
  await page.getByRole("button", { name: "Aus Bibliothek hinzufügen" }).click();
  await page.getByTestId("picker-grid").getByRole("checkbox").check();
  await page.getByRole("button", { name: "1 hinzufügen" }).click();
  await expect(page.getByTestId("gallery-media").locator("li")).toHaveCount(1);

  await page.getByRole("link", { name: "← Alle Galerien" }).click();
  await expect(page.getByTestId("gallery-list")).toContainText(
    "Veröffentlicht",
  );
  await expect(page.getByTestId("gallery-list")).toContainText(
    "Ablauf: 1.5.2027",
  );
});
