import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", workers: 1, timeout: 45_000,
  use: {
    baseURL: "http://localhost:3000", viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: "npm run start:client", url: "http://localhost:3000", timeout: 30_000,
    reuseExistingServer: false,
  },
});
