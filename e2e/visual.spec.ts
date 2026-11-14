import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

/** CI: `npm run test:e2e -- --project=chromium` (see `.github/workflows/ci.yml`). */
test.describe("visual regression", () => {
  test("town viewport", async ({ page }) => {
    await gotoE2E(page);
    await expect(page).toHaveScreenshot("town-540x1200.png", {
      clip: { x: 0, y: 0, width: 540, height: 1200 },
    });
  });

  test("defense viewport", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      await api?.spawnTestEnemy(120, 0);
    });
    await expect(page).toHaveScreenshot("defense-540x1200.png", {
      clip: { x: 0, y: 0, width: 540, height: 1200 },
      maxDiffPixelRatio: 0.04,
    });
  });
});