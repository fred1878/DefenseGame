import { test, expect } from "@playwright/test";
import { GAME } from "../src/config/game";
import { gotoE2E, startDefense } from "./helpers/game";

test.describe("defense HUD layout", () => {
  test("spell slot centers sit in bottom 15% of viewport", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      await window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0);
    });

    const targets = await page.evaluate(() => {
      return window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
    });

    for (let i = 0; i < 3; i++) {
      const key = `spell-slot-${i}`;
      const pt = targets[key];
      expect(pt, `missing ${key}`).toBeTruthy();
      expect(pt!.y).toBeGreaterThan(GAME.height * 0.85);
      expect(pt!.y).toBeGreaterThan(1000);
    }
  });
});