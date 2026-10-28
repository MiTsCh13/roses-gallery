import { expect, test } from "@playwright/test";

test("uploads a video via tus and plays it once it is ready", async ({
  page,
  request,
}, testInfo) => {
  const email = `video+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page).toHaveURL(/\/login\/check-email/);
  const mail = await request.get(
    `/api/test/mailbox?to=${encodeURIComponent(email)}`,
  );
  await page.goto((await mail.json()).text.match(/https?:\/\/\S+/)![0]);
  await expect(page).toHaveURL(/\/dashboard/);

  const { setId } = await (
    await page.request.post("/api/test/seed-set?type=video")
  ).json();
  await page.goto(`/dashboard/sets/${setId}`);
  await expect(page.getByText("Noch keine Videos")).toBeVisible();

  await page.getByTestId("video-input").setInputFiles({
    name: "trauung.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(2 * 1024 * 1024, 7),
  });
  await expect(
    page.getByTestId("video-upload-list").locator('[data-state="done"]'),
  ).toHaveCount(1);

  const item = page.getByTestId("video-list").locator("li");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("wartet auf Upload");

  const mediaId = await item.getAttribute("data-id");
  const ready = await page.request.post("/api/test/video-ready", {
    data: { mediaId },
  });
  expect(ready.ok()).toBe(true);

  // The page pulls the provider state itself (webhook-independent).
  await page.reload();
  await expect(item).toContainText("bereit");
  await page.getByRole("button", { name: "Abspielen" }).click();
  await expect(page.getByTestId("video-player")).toHaveAttribute(
    "src",
    /\/api\/test\/player\//,
  );

  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Original herunterladen" })
    .first()
    .click();
  expect((await download).suggestedFilename()).toBe("original.mp4");
});
