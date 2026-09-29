import { defineConfig, devices } from "@playwright/test";

/**
 * E2E: boots the sync server and the web app, then drives two browser contexts
 * in the same room. Requires LIVEBOARD_JWT_SECRET in the environment or ../../.env.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @liveboard/server dev",
      url: "http://localhost:1234/healthz",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @liveboard/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
