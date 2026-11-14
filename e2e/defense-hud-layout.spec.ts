import { test, expect } from "@playwright/test";
import { GAME } from "../src/config/game";
import { gotoE2E, startDefense } from "./helpers/game";

test.describe("defense HUD layout", () => {
  test("spell slot centers stay in lower viewport band", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      await window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0);
    });

    const targets = await page.evaluate(() => {
      return window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
    });

    // Main HUD: spell row ~924px. Gothic bottom-strip layout (PR #36) raises this above 0.85 * height.
    const minSpellCenterY = GAME.height * 0.75;

    for (let i = 0; i < 3; i++) {
      const key = `spell-slot-${i}`;
      const pt = targets[key];
      expect(pt, `missing ${key}`).toBeTruthy();
      expect(pt!.y).toBeGreaterThan(minSpellCenterY);
    }
  });
});