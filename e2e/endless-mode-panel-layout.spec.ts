import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 1200;
const VIEWPORT_MARGIN = 8;

test.describe("endless mode panel layout", () => {
  test("footer actions stay in viewport and roster scrolls", async ({ page }) => {
    await gotoE2E(page);
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel());
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const targets = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {},
    );
    for (const key of ["endless-start", "endless-close"]) {
      const pt = targets[key];
      expect(pt, `missing ${key}`).toBeTruthy();
      expect(pt!.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(pt!.x).toBeLessThanOrEqual(GAME_WIDTH - VIEWPORT_MARGIN);
      expect(pt!.y).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(pt!.y).toBeLessThanOrEqual(GAME_HEIGHT - VIEWPORT_MARGIN);
    }

    const scrollState = await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      const state = api?.getEndlessEnemyListScrollState();
      const enemyKeys = Object.keys(api?.getUiTapTargets() ?? {}).filter((k) =>
        k.startsWith("endless-enemy-"),
      );
      const lastEnemyId = enemyKeys
        .sort()
        .at(-1)
        ?.replace("endless-enemy-", "");
      return { state, lastEnemyId, enemyCount: enemyKeys.length };
    });

    expect(scrollState.enemyCount).toBeGreaterThan(0);
    expect(scrollState.state).toBeTruthy();
    if (
      scrollState.state &&
      scrollState.state.maxScroll > 0 &&
      scrollState.lastEnemyId
    ) {
      await page.evaluate(() => {
        const api = window.__DEFENSEGAME_E2E__?.api;
        const max = api?.getEndlessEnemyListScrollState()?.maxScroll ?? 0;
        api?.scrollEndlessEnemyList(max + 50);
      });

      const lastInView = await page.evaluate((enemyId) => {
        const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
        return targets[`endless-enemy-${enemyId}`] ?? null;
      }, scrollState.lastEnemyId);

      expect(lastInView).toBeTruthy();
      expect(lastInView!.y).toBeGreaterThanOrEqual(
        scrollState.state.listTop + VIEWPORT_MARGIN,
      );
      expect(lastInView!.y).toBeLessThanOrEqual(
        scrollState.state.listTop +
          scrollState.state.listViewportH -
          VIEWPORT_MARGIN,
      );
    }

    await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      const max = api?.getEndlessEnemyListScrollState()?.maxScroll ?? 0;
      api?.scrollEndlessEnemyList(-max - 50);
    });

    const firstEnemy = await page.evaluate(() => {
      const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      const key = Object.keys(targets)
        .filter((k) => k.startsWith("endless-enemy-"))
        .sort()[0];
      return key ? targets[key] : null;
    });
    expect(firstEnemy).toBeTruthy();
    expect(firstEnemy!.y).toBeGreaterThanOrEqual(
      scrollState.state!.listTop + VIEWPORT_MARGIN,
    );
    expect(firstEnemy!.y).toBeLessThanOrEqual(GAME_HEIGHT - VIEWPORT_MARGIN);
  });
});