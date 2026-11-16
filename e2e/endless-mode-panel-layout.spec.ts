import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { tapCanvas } from "./helpers/touch";

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
      const roster = api?.getEndlessRosterEnemyIds() ?? [];
      const lastEnemyId = roster.at(-1) ?? null;
      return { state, lastEnemyId, enemyCount: enemyKeys.length, rosterLen: roster.length };
    });

    expect(scrollState.rosterLen).toBeGreaterThan(0);
    expect(scrollState.enemyCount).toBeGreaterThan(0);
    expect(scrollState.enemyCount).toBeLessThanOrEqual(
      scrollState.state!.maxVisibleRows,
    );
    expect(scrollState.state).toBeTruthy();
    expect(scrollState.state!.maxVisibleRows).toBe(4);
    if (scrollState.state!.maxScroll > 0) {
      expect(scrollState.state!.scrollbarVisible).toBe(true);
    }
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

  test("footer taps do not change hidden roster selection", async ({
    page,
  }) => {
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

    const initial = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getEndlessSelectedEnemyId() ?? "",
    );
    expect(initial).toBeTruthy();

    const start = await page.evaluate(
      () =>
        window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets()["endless-start"],
    );
    expect(start).toBeTruthy();
    await tapCanvas(page, start!.x, start!.y + 28);

    const after = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getEndlessSelectedEnemyId() ?? "",
    );
    expect(after).toBe(initial);
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen()),
          ),
        { timeout: 3_000 },
      )
      .toBe(true);
  });
});