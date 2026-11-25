import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 1200;
const VIEWPORT_MARGIN = 8;

test.describe("@manual town spell panel layout", () => {
  test("sort slots are in viewport and 2× defense hit size", async ({
    page,
  }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openSpellSortPanel(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isSpellSortPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const { targets, hitRects, defenseRects } = await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      return {
        targets: api?.getUiTapTargets() ?? {},
        hitRects: api?.getSpellSortSlotHitRects() ?? [],
        defenseRects: [] as Array<{ width: number; height: number }>,
      };
    });

    expect(hitRects.length).toBe(8);
    // 2× bar grid sits below wrapped hint (regression: bar must not cover instruction copy).
    expect(hitRects[0]!.y).toBeGreaterThanOrEqual(220);

    for (let i = 0; i < hitRects.length; i++) {
      const key = `spell-sort-slot-${i}`;
      const pt = targets[key];
      expect(pt, `missing ${key}`).toBeTruthy();
      const rect = hitRects[i]!;
      expect(rect.width).toBeGreaterThanOrEqual(60);
      expect(rect.height).toBeGreaterThanOrEqual(60);
      expect(pt!.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(pt!.x).toBeLessThanOrEqual(GAME_WIDTH - VIEWPORT_MARGIN);
      expect(pt!.y).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(pt!.y).toBeLessThanOrEqual(GAME_HEIGHT - VIEWPORT_MARGIN);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(GAME_HEIGHT);
    }
    void defenseRects;
  });
});
