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

test("free plan by default, then a trial subscription unlocks the plan", async ({
  page,
  request,
}, testInfo) => {
  const email = `bill+${testInfo.project.name}-${Date.now()}@foto-rose.de`;
  await signUp(page, request, email);

  await page.goto("/dashboard/billing");
  await expect(page.getByTestId("current-plan")).toContainText("Free");
  await expect(page.getByTestId("storage-usage")).toContainText("von 2 GB");

  // Fake checkout returns straight to the success URL.
  await page
    .getByTestId("plan-side_line")
    .getByRole("button", { name: /\/ Monat/ })
    .click();
  await expect(page).toHaveURL(/checkout=success/);

  // The webhook (normally sent by Stripe) grants the plan.
  const accountId = await page.evaluate(async () => {
    const res = await fetch("/api/auth/session");
    return (await res.json()).user?.accountId as string | undefined;
  });
  expect(accountId).toBeTruthy();
  const hook = await request.post("/api/stripe/webhook", {
    headers: { "stripe-signature": "fake-signature" },
    data: JSON.stringify({
      id: "evt_e2e",
      occurredAt: new Date().toISOString(),
      accountId,
      customerId: "cus_e2e",
      subscriptionId: "sub_e2e",
      plan: "side_line",
      interval: "month",
      status: "trialing",
      trialEndsAt: new Date(Date.now() + 14 * 864e5).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 14 * 864e5).toISOString(),
    }),
  });
  expect(hook.ok()).toBe(true);

  await page.goto("/dashboard/billing");
  await expect(page.getByTestId("current-plan")).toContainText(
    "Side Line · Testphase",
  );
  await expect(page.getByTestId("storage-usage")).toContainText("von 100 GB");
  await expect(
    page.getByRole("button", { name: "Abo verwalten" }),
  ).toBeVisible();
});

test("billing page requires a login", async ({ page }) => {
  await page.goto("/dashboard/billing");
  await expect(page).toHaveURL(/\/login/);
});
