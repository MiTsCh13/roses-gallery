import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm db:migrate && pnpm start --port ${PORT}`,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgres://roses:roses@localhost:5432/roses_gallery",
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
      AUTH_SECRET: "e2e-only-secret-not-for-production-use",
      AUTH_URL: `http://localhost:${PORT}`,
      AUTH_TRUST_HOST: "true",
      MAIL_TRANSPORT: "fake",
      BILLING_TRANSPORT: "fake",
      STORAGE_TRANSPORT: "fake",
      E2E_TEST_MODE: "1",
    },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
