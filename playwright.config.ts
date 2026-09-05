import { defineConfig, devices } from "@playwright/test";

import { readToolEnvironment } from "./src/lib/env";

const { CI, PLAYWRIGHT_BASE_URL } = readToolEnvironment();
const isContinuousIntegration = Boolean(CI);
const baseURL = PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isContinuousIntegration,
  retries: isContinuousIntegration ? 1 : 0,
  reporter: isContinuousIntegration ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  ...(PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: "pnpm start",
          url: baseURL,
          reuseExistingServer: !isContinuousIntegration,
        },
      }),
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
