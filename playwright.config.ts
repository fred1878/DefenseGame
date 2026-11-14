import { defineConfig, devices } from "@playwright/test";

const previewHost = process.env.E2E_HOST ?? "127.0.0.1";
const previewPort = process.env.E2E_PORT ?? "4173";
const baseURL = `http://${previewHost}:${previewPort}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      // Playwright defaults maxDiffPixels to 0 (any mismatch fails). Linux CI can
      // differ by a handful of antialiased pixels vs local baselines.
      maxDiffPixels: 32,
    },
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 540, height: 1200 },
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `VITE_BASE=/ npm run preview -- --port ${previewPort} --host ${previewHost}`,
        url: baseURL,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});