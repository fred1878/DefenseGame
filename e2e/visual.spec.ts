import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

test.describe("visual regression", () => {
  test("town viewport", async ({ page }) => {
    await gotoE2E(page);
    await expect(page).toHaveScreenshot("town-540x1200.png", {
      fullPage: true,
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
      fullPage: true,
      maxDiffPixelRatio: 0.04,
    });
  });
});