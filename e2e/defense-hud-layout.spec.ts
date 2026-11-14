/**
 * Defense HUD geometry + asset checks (not full-page pixels).
 *
 * Visual regression pixels live in `e2e/visual.spec.ts`. CI runs Playwright with
 * `--project=chromium` only (`.github/workflows/ci.yml`). Run `mobile-chrome`
 * locally when checking DPR-scaled snapshots.
 */
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

const BOTTOM_PANEL_TEXTURE = "ui_hud_panel_tall";

test.describe("defense HUD layout", () => {
  test("bottom panel chrome, spell row in strip band", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      await window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0);
    });

    const stripLoaded = await page.evaluate(
      (key) => window.__DEFENSEGAME_E2E__?.api?.textureLoaded(key),
      BOTTOM_PANEL_TEXTURE,
    );
    expect(stripLoaded).toBe(true);

    const chromeKey = await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.e2eBottomChromeTextureKey(),
    );
    expect(chromeKey).toBe(BOTTOM_PANEL_TEXTURE);

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

    const rects = await page.evaluate(() => {
      const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      const spell0 = targets["spell-slot-0"];
      const debug = targets["defense-debug"];
      if (!spell0 || !debug) return null;
      const pad = 28;
      const spellR = {
        x: spell0.x - pad,
        y: spell0.y - pad,
        w: pad * 2,
        h: pad * 2,
      };
      const debugR = { x: debug.x - pad, y: debug.y - pad, w: pad * 2, h: pad * 2 };
      const hit =
        debugR.x < spellR.x + spellR.w &&
        debugR.x + debugR.w > spellR.x &&
        debugR.y < spellR.y + spellR.h &&
        debugR.y + debugR.h > spellR.y;
      return { spell0, debug, hit };
    });
    expect(rects).not.toBeNull();
    expect(rects!.hit, JSON.stringify(rects)).toBe(false);
  });
});