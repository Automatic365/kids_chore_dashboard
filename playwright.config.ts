import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet-landscape",
      use: { browserName: "chromium", ...devices["iPad (gen 7) landscape"] },
    },
    {
      name: "mobile-iphone",
      use: { browserName: "chromium", ...devices["iPhone 12"] },
    },
    {
      name: "mobile-android",
      use: { browserName: "chromium", ...devices["Pixel 7"] },
    },
  ],
});
