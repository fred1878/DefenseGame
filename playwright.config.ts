import { availableParallelism } from "node:os";
import { defineConfig, devices } from "@playwright/test";

const previewHost = process.env.E2E_HOST ?? "127.0.0.1";
const previewPort = process.env.E2E_PORT ?? "4173";
const baseURL = `http://${previewHost}:${previewPort}`;

/**
 * Worker defaults come from the worker/shard benchmark in docs/TESTING.md:
 * - CI: 3 workers per shard (ci.yml runs 3 shards) on 4-vCPU runners.
 * - Local: one worker per core (8 cores: 2.6 min vs 10.9 min at 1 worker).
 * `E2E_WORKERS` overrides both.
 */
function resolveE2EWorkers(): number {
  const raw = process.env.E2E_WORKERS;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return process.env.CI ? 3 : Math.max(1, availableParallelism());
}

export default defineConfig({
  testDir: "e2e",
  // CI skips suites/tests tagged @manual in describe/title (see docs/TESTING.md).
  ...(process.env.CI ? { grepInvert: /@manual/ } : {}),
  // Tests run in parallel everywhere; specs that share state use
  // `test.describe.configure({ mode: "serial" })` with a shared boot.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: resolveE2EWorkers(),
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  use: {
    baseURL,
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 540, height: 1200 },
  },
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: `VITE_BASE=/ npm run preview -- --port ${previewPort} --host ${previewHost}`,
          url: baseURL,
          reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
          timeout: 120_000,
        },
      }),
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Device preset defaults to 1280×720; game viewport is 540×1200.
        viewport: { width: 540, height: 1200 },
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
