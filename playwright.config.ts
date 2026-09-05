import { defineConfig, devices } from "@playwright/test";

import { readToolEnvironment } from "./src/lib/env";

const { CI } = readToolEnvironment();
const isContinuousIntegration = Boolean(CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isContinuousIntegration,
  retries: isContinuousIntegration ? 1 : 0,
  reporter: isContinuousIntegration ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !isContinuousIntegration,
  },
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
