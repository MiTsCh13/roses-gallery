import { expect, test } from "@playwright/test";

// „Als Titelbild“ im Medienpanel: nur ein einzelnes markiertes Foto kann
// Titelbild werden; die Wahl bleibt nach dem Neuladen erhalten.
test("gallery editor: mark a photo as cover", async ({
  page,
  request,
}, testInfo) => {
  const email = `cover+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/check-email/);
  const { text } = await (
    await request.get(`/api/test/mailbox?to=${encodeURIComponent(email)}`)
  ).json();
  await page.goto(text.match(/https?:\/\/\S+/)![0]);
  await page.goto("/dashboard/galleries/new");
  await page.getByLabel("Titel").fill("Titelbild-Test");
  await page.getByRole("button", { name: "Galerie anlegen" }).click();
  await expect(page).toHaveURL(/galleries\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");

  // Ein Video und ein Foto direkt in die Galerie hochladen (Foto bleibt ohne
  // Worker „in Verarbeitung“, kann aber schon Titelbild werden).
  await page.getByTestId("gallery-file-input").setInputFiles([
    {
      name: "film.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1024 * 1024, 3),
    },
    { name: "paar.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(2048, 1) },
  ]);
  await expect(
    page.getByTestId("gallery-uploads").locator('[data-state="done"]'),
  ).toHaveCount(2);
  const media = page.getByTestId("gallery-media").locator("li");
  await expect(media).toHaveCount(2);

  const photo = media.filter({ has: page.getByTestId("media-processing") });
  const video = media.filter({ hasNot: page.getByTestId("media-processing") });
  const makeCover = page.getByRole("button", { name: "Als Titelbild" });

  // Video markiert → kein Titelbild möglich
  await video.getByRole("checkbox").check();
  await expect(makeCover).toBeDisabled();
  // Video + Foto markiert → ebenfalls nicht (nur ein einzelnes Foto)
  await photo.getByRole("checkbox").check();
  await expect(makeCover).toBeDisabled();
  await video.getByRole("checkbox").uncheck();
  await expect(makeCover).toBeEnabled();

  await makeCover.click();
  await expect(photo.getByText("Titelbild", { exact: true })).toBeVisible();
  await expect(video.getByText("Titelbild", { exact: true })).toHaveCount(0);
  // Markierung wird nach dem Setzen aufgehoben
  await expect(photo.getByRole("checkbox")).not.toBeChecked();

  await page.reload();
  await expect(
    page
      .getByTestId("gallery-media")
      .locator("li")
      .filter({ has: page.getByTestId("media-processing") })
      .getByText("Titelbild", { exact: true }),
  ).toBeVisible();
});
