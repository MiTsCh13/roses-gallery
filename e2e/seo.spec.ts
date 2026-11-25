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
  expect(xml).toContain("/blog/galerie-link-statt-dropbox</loc>");
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

test("www host redirects permanently to the apex domain", async ({
  request,
}) => {
  const res = await request.get("/preise?x=1", {
    headers: { host: "www.roses-gallery.app" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(308);
  expect(res.headers().location).toBe("https://roses-gallery.app/preise?x=1");

  const apex = await request.get("/preise", { maxRedirects: 0 });
  expect(apex.status()).toBe(200);
});

test("logo: header mark, favicon, apple icon and logo file", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByTestId("brand-mark").first(),
  ).toBeVisible();
  const icon = await page
    .locator('link[rel="icon"][type="image/svg+xml"]')
    .getAttribute("href");
  expect(icon).toMatch(/^\/icon\.svg/);
  for (const path of [icon!, "/apple-icon.png", "/logo.png"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
  }
});

test("audience pages: own title, canonical, links from home and sitemap", async ({
  page,
  request,
}) => {
  const pages = [
    {
      path: "/fuer-fotografen",
      h1: "Die Online-Galerie für deine Hochzeitsfotos",
      title: /Online-Galerie für Hochzeitsfotograf:innen/,
      link: "Für Fotograf:innen",
      other: "Für Videograf:innen",
    },
    {
      path: "/fuer-videografen",
      h1: "Hochzeitsfilme online übergeben – in bis zu 4K",
      title: /Hochzeitsvideos online an Kund:innen ausliefern/,
      link: "Für Videograf:innen",
      other: "Für Fotograf:innen",
    },
  ];
  for (const p of pages) {
    await page.goto("/");
    await page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(p.link) })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${p.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.h1);
    await expect(page).toHaveTitle(p.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${p.path}$`),
    );
    await expect(
      page.getByRole("main").getByRole("link", { name: p.other }),
    ).toBeVisible();
  }
  // Drafts are never linked; the published post is.
  await page.goto("/fuer-videografen");
  await expect(
    page.locator(
      'a[href="/blog/hochzeitsvideos-ohne-qualitaetsverlust-ausliefern"]',
    ),
  ).toHaveCount(0);
  await expect(
    page.locator('a[href="/blog/galerie-link-statt-dropbox"]'),
  ).toHaveCount(1);

  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/fuer-fotografen</loc>");
  expect(xml).toContain("/fuer-videografen</loc>");
});
