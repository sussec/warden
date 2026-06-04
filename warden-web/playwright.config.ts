import { defineConfig, devices } from "@playwright/test";

// E2E against the running compose stack (web on :8080). Headless Chromium.
// Override with BASE_URL / WARDEN_USER / WARDEN_PASSWORD.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: "e2e-results.json" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8080",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // bundled headless shell, no system Chrome dependency
        launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
      },
    },
  ],
});
