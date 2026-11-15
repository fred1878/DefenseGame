import { test } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import { expectViewportScreenshot } from "./helpers/visualSnapshot";

/** CI: `npm run test:e2e -- --project=chromium` (see `.github/workflows/ci.yml`). */
const VIEWPORT_CLIP = { x: 0, y: 0, width: 540, height: 1200 } as const;

/** CI: `npm run test:e2e -- --project=chromium` (see `.github/workflows/ci.yml`). */
test.describe("visual regression", () => {
  test("town viewport", async ({ page }, testInfo) => {
    await gotoE2E(page);
    await expectViewportScreenshot(page, testInfo, "town-540x1200.png", {
      clip: VIEWPORT_CLIP,
      maxDiffPixelRatio: 0.04,
    });
  });

  test("defense viewport", async ({ page }, testInfo) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      await api?.spawnTestEnemy(120, 0);
    });
    await expectViewportScreenshot(page, testInfo, "defense-540x1200.png", {
      clip: VIEWPORT_CLIP,
      maxDiffPixelRatio: 0.04,
    });
  });
});