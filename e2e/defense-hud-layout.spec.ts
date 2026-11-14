/**
 * Defense HUD geometry + asset checks (not full-page pixels).
 *
 * Visual regression pixels live in `e2e/visual.spec.ts`. CI runs Playwright with
 * `--project=chromium` only (`.github/workflows/ci.yml`). Run `mobile-chrome`
 * locally when checking DPR-scaled snapshots.
 */
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

const BOTTOM_STRIP_TEXTURE = "ui_hud_bottom_strip";

test.describe("defense HUD layout", () => {
  test("bottom strip chrome, spell row in strip band", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      await window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0);
    });

    const stripLoaded = await page.evaluate(
      (key) => window.__DEFENSEGAME_E2E__?.api?.textureLoaded(key),
      BOTTOM_STRIP_TEXTURE,
    );
    expect(stripLoaded).toBe(true);

    const chromeKey = await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.e2eBottomChromeTextureKey(),
    );
    expect(chromeKey).toBe(BOTTOM_STRIP_TEXTURE);

    const { targets, stripCenterY, stripH } = await page.evaluate(() => {
      const hud = window.__HUD_DEBUG__ as
        | { stripCenterY: number; stripH: number }
        | undefined;
      return {
        targets: window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {},
        stripCenterY: hud?.stripCenterY ?? 0,
        stripH: hud?.stripH ?? 0,
      };
    });

    expect(stripCenterY).toBeGreaterThan(1000);
    const bandHalf = stripH / 2 + 36;

    for (let i = 0; i < 3; i++) {
      const key = `spell-slot-${i}`;
      const pt = targets[key];
      expect(pt, `missing ${key}`).toBeTruthy();
      expect(pt!.y).toBeGreaterThan(1000);
      expect(pt!.y).toBeGreaterThanOrEqual(stripCenterY - bandHalf);
      expect(pt!.y).toBeLessThanOrEqual(stripCenterY + bandHalf);
    }
  });
});