import { expect, test } from "@playwright/test";

test("sitemap lists website pages but no app routes", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  for (const path of ["/preise", "/blog", "/impressum"]) {
    expect(xml).toContain(`${path}</loc>`);
  }
  for (const path of ["/dashboard", "/api", "/g/", "/login"]) {
    expect(xml).not.toContain(path);
  }
  // Entwürfe erscheinen nicht.
  expect(xml).not.toContain("hochzeitsvideos-ohne-qualitaetsverlust");
});

test("robots.txt blocks app, api, galleries and login", async ({ request }) => {
  const text = await (await request.get("/robots.txt")).text();
  expect(text).toContain("Allow: /");
  for (const path of ["/dashboard", "/api", "/g/", "/login"]) {
    expect(text).toContain(`Disallow: ${path}`);
  }
  expect(text).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
});

test("client galleries and the app are noindex", async ({ page, request }) => {
  const gallery = await request.get("/g/gibt-es-nicht");
  expect(gallery.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await page.goto("/g/gibt-es-nicht");
  const robots = await page
    .locator('meta[name="robots"]')
    .evaluateAll((metas) => metas.map((m) => m.getAttribute("content")));
  expect(robots.length).toBeGreaterThan(0);
  for (const content of robots) expect(content).toContain("noindex");
  const login = await request.get("/login");
  expect(login.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const home = await request.get("/");
  expect(home.headers()["x-robots-tag"]).toBeUndefined();
});

test("website pages carry canonical, open graph and JSON-LD", async ({
  page,
  request,
}) => {
  await page.goto("/preise");
  await expect(page).toHaveTitle("Preise | Roses Gallery");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/preise$/,
  );

  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https?:\/\/[^/]+\/?$/,
  );
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute("content");
  expect(ogImage).toMatch(/^https?:\/\/.+\/opengraph-image/);
  const image = await request.get(new URL(ogImage!).pathname);
  expect(image.headers()["content-type"]).toBe("image/png");

  const ld = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ??
      "[]",
  ) as { "@type": string; offers?: { price: string }[] }[];
  expect(ld.map((x) => x["@type"])).toEqual([
    "Organization",
    "SoftwareApplication",
  ]);
  expect(ld[1].offers?.length).toBe(4);
});
