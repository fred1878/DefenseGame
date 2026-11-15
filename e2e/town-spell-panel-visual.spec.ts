import { test } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { expectViewportScreenshot } from "./helpers/visualSnapshot";

const PANEL_CLIP = { x: 0, y: 0, width: 540, height: 1200 } as const;

test.describe("town spell panel visual", () => {
  test("witchlight spell bar editor with icon pool", async ({ page }, testInfo) => {
    await gotoE2E(page);
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.openSpellSortPanel());
    await page.waitForTimeout(400);
    await expectViewportScreenshot(page, testInfo, "town-spell-panel-540x1200.png", {
      clip: PANEL_CLIP,
      maxDiffPixelRatio: 0.07,
    });
  });
});