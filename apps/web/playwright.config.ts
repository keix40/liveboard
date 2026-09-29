import { defineConfig, devices } from "@playwright/test";

/**
 * E2E: boots the sync server and the web app, then drives two browser contexts
 * in the same room. Requires LIVEBOARD_JWT_SECRET in the environment or ../../.env.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chromium",
      testMatch: /mobile\.spec\.ts|touch-draw\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "webkit-iphone",
      testMatch: /toolbar-layout\.spec\.ts|mobile\.spec\.ts/,
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "webkit-ipad",
      testMatch: /toolbar-layout\.spec\.ts/,
      use: { ...devices["iPad Pro 11"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @liveboard/server dev",
      url: "http://localhost:1234/healthz",
      reuseExistingServer: !process.env.CI,
      env: {
        LIVEBOARD_JWT_SECRET:
          process.env.LIVEBOARD_JWT_SECRET ?? "test-secret-test-secret-test-secret-123",
        PERSISTENCE: "memory",
      },
    },
    {
      command: "pnpm --filter @liveboard/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      env: {
        LIVEBOARD_JWT_SECRET:
          process.env.LIVEBOARD_JWT_SECRET ?? "test-secret-test-secret-test-secret-123",
        NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234",
      },
    },
  ],
});
