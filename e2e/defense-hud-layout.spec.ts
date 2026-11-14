/**
 * Defense HUD geometry + asset checks (not full-page pixels).
 *
 * Visual regression pixels live in `e2e/visual.spec.ts`. CI runs Playwright with
 * `--project=chromium` only (`.github/workflows/ci.yml`). Run `mobile-chrome`
 * locally when checking DPR-scaled snapshots.
 */
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

test.describe("defense HUD layout", () => {
  test("no bottom panel chrome, spell row left of MEL", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      await window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0);
    });

    const chromeKey = await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.e2eBottomChromeTextureKey(),
    );
    expect(chromeKey).toBeNull();

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

    const overlap = await page.evaluate(() => {
      const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      const pad = 28;
      const rects = (id: string) => {
        const pt = targets[id];
        if (!pt) return null;
        return { x: pt.x - pad, y: pt.y - pad, w: pad * 2, h: pad * 2 };
      };
      const hits = (a: NonNullable<ReturnType<typeof rects>>, b: NonNullable<ReturnType<typeof rects>>) =>
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;

      const spell2 = rects("spell-slot-2");
      const mel = rects("combat-mode");
      const spell0 = rects("spell-slot-0");
      const debug = rects("defense-debug");
      if (!spell2 || !mel || !spell0 || !debug) return null;
      return {
        spellMel: hits(spell2, mel),
        debugSpell: hits(debug, spell0),
        spell2,
        mel,
        spell0,
        debug,
      };
    });
    expect(overlap).not.toBeNull();
    expect(overlap!.spellMel, JSON.stringify(overlap)).toBe(false);
    expect(overlap!.debugSpell, JSON.stringify(overlap)).toBe(false);
  });
});