import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { type CanvasBox, dragCanvas, tapCanvas } from "./helpers/touch";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 1200;
const VIEWPORT_MARGIN = 8;

test.describe("endless mode panel layout", () => {
  test("infinite HP defaults on when panel opens", async ({ page }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    expect(
      await page.evaluate(
        () => window.__DEFENSEGAME_E2E__?.api?.getEndlessInfiniteHp() ?? false,
      ),
    ).toBe(true);
  });

  test("challenge rating sits between infinite HP and start", async ({
    page,
  }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const layout = await page.evaluate(() => {
      const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      return {
        infiniteHp: targets["endless-infinite-hp"],
        challengeRating: targets["endless-challenge-rating"],
        start: targets["endless-start"],
      };
    });
    expect(layout.infiniteHp).toBeTruthy();
    expect(layout.challengeRating).toBeTruthy();
    expect(layout.start).toBeTruthy();
    expect(layout.challengeRating!.y).toBeGreaterThan(
      layout.infiniteHp!.y + 20,
    );
    expect(layout.start!.y).toBeGreaterThan(layout.challengeRating!.y + 12);
  });

  test("footer actions stay in viewport and roster scrolls", async ({
    page,
  }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );
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
    for (const key of [
      "endless-infinite-hp",
      "endless-start",
      "endless-close",
    ]) {
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
      return {
        state,
        lastEnemyId,
        enemyCount: enemyKeys.length,
        rosterLen: roster.length,
      };
    });

    expect(scrollState.rosterLen).toBeGreaterThan(0);
    expect(scrollState.enemyCount).toBeGreaterThan(0);
    expect(scrollState.enemyCount).toBeLessThanOrEqual(
      scrollState.state!.maxVisibleRows,
    );
    expect(scrollState.state).toBeTruthy();
    expect(scrollState.state!.maxVisibleRows).toBe(6);
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
        const targets =
          window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
        return {
          row: targets[`endless-enemy-${enemyId}`] ?? null,
          minus: targets[`endless-cap-minus-${enemyId}`] ?? null,
          plus: targets[`endless-cap-plus-${enemyId}`] ?? null,
        };
      }, scrollState.lastEnemyId);

      expect(lastInView.row).toBeTruthy();
      expect(lastInView.minus).toBeTruthy();
      expect(lastInView.plus).toBeTruthy();
      for (const pt of [lastInView.row, lastInView.minus, lastInView.plus]) {
        expect(pt!.y).toBeGreaterThanOrEqual(
          scrollState.state.listTop + VIEWPORT_MARGIN,
        );
        expect(pt!.y).toBeLessThanOrEqual(
          scrollState.state.listTop +
            scrollState.state.listViewportH -
            VIEWPORT_MARGIN,
        );
        expect(pt!.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
        expect(pt!.x).toBeLessThanOrEqual(GAME_WIDTH - VIEWPORT_MARGIN);
      }
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

  test("roster drag scroll shifts list offset", async ({ page }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );

    // One poll for "panel open + roster laid out": while the modal is up every
    // page round trip waits on a (software-rendered) frame on CI, so keep them few.
    type DragPlan =
      | { scrollable: false }
      | {
          scrollable: true;
          x: number;
          y: number;
          scrollBefore: number;
          canvasBox: CanvasBox;
        };
    let plan: DragPlan | null = null;
    await expect
      .poll(
        async () => {
          plan = await page.evaluate((): DragPlan | null => {
            const api = window.__DEFENSEGAME_E2E__?.api;
            if (!api?.isEndlessPanelOpen()) return null;
            const state = api.getEndlessEnemyListScrollState();
            if (!state) return null;
            if (state.maxScroll <= 0) return { scrollable: false };
            const targets = api.getUiTapTargets() ?? {};
            const firstKey = Object.keys(targets)
              .filter((k) => k.startsWith("endless-enemy-"))
              .sort()[0];
            const row = firstKey ? targets[firstKey] : null;
            const canvas = document.querySelector("#game canvas");
            if (!row || !canvas) return null;
            const rect = canvas.getBoundingClientRect();
            return {
              scrollable: true,
              x: row.x,
              y: row.y,
              scrollBefore: state.scrollY,
              canvasBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            };
          });
          return plan !== null;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    const drag = plan as DragPlan | null;
    test.skip(!drag?.scrollable, "Roster fits without scrolling");
    if (!drag?.scrollable) return;

    // Drag distance (90px) is far above the 10px tap threshold, so two
    // moves are enough; each one is a renderer round trip.
    await dragCanvas(page, drag.x, drag.y, drag.x, drag.y - 90, {
      steps: 2,
      canvasBox: drag.canvasBox,
    });

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.__DEFENSEGAME_E2E__?.api?.getEndlessEnemyListScrollState()
                ?.scrollY ?? 0,
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThan(drag.scrollBefore + 8);
  });

  test("start is blocked when no enemies are selected", async ({ page }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const firstId = await page.evaluate(
      () =>
        window.__DEFENSEGAME_E2E__?.api?.getEndlessSelectedEnemyIds()[0] ?? "",
    );
    expect(firstId).toBeTruthy();
    await page.evaluate((enemyId) => {
      window.__DEFENSEGAME_E2E__?.api?.toggleEndlessEnemy(enemyId);
    }, firstId);

    const noneSelected = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getEndlessSelectedEnemyIds() ?? [],
    );
    expect(noneSelected).toEqual([]);

    const start = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets()["endless-start"],
    );
    expect(start).toBeTruthy();
    await tapCanvas(page, start!.x, start!.y);

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

  test("enemy name row tap toggles selection", async ({ page }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const target = await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      const selected = new Set(api?.getEndlessSelectedEnemyIds() ?? []);
      const roster = api?.getEndlessRosterEnemyIds() ?? [];
      const enemyId =
        roster.find((id) => !selected.has(id)) ?? roster[1] ?? "grunt";
      const pt = api?.getUiTapTargets()[`endless-enemy-${enemyId}`];
      return { enemyId, pt };
    });
    expect(target.pt).toBeTruthy();

    await tapCanvas(page, target.pt!.x, target.pt!.y);

    const selected = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getEndlessSelectedEnemyIds() ?? [],
    );
    expect(selected).toContain(target.enemyId);
  });

  test("cap plus/minus adjusts count without toggling selection", async ({
    page,
  }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const enemyId = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getEndlessSelectedEnemyId() ?? "",
    );
    expect(enemyId).toBeTruthy();
    const capBefore = await page.evaluate(
      (id) =>
        window.__DEFENSEGAME_E2E__?.api?.getEndlessEnemyConcurrentCap(id) ?? 0,
      enemyId,
    );

    const plus = await page.evaluate(
      (id) =>
        window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets()[
          `endless-cap-plus-${id}`
        ],
      enemyId,
    );
    expect(plus).toBeTruthy();
    await tapCanvas(page, plus!.x, plus!.y);

    const capAfter = await page.evaluate(
      (id) =>
        window.__DEFENSEGAME_E2E__?.api?.getEndlessEnemyConcurrentCap(id) ?? 0,
      enemyId,
    );
    expect(capAfter).toBeGreaterThan(capBefore);

    const selected = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getEndlessSelectedEnemyIds() ?? [],
    );
    expect(selected).toContain(enemyId);
  });

  test("footer taps do not change hidden roster selection", async ({
    page,
  }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );
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

    const infiniteHp = await page.evaluate(
      () =>
        window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets()[
          "endless-infinite-hp"
        ],
    );
    expect(infiniteHp).toBeTruthy();
    await tapCanvas(page, infiniteHp!.x, infiniteHp!.y);

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

  test("multi-select and per-type caps reach defense spawn", async ({
    page,
  }) => {
    await gotoE2E(page);
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const pair = await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      const roster = api?.getEndlessRosterEnemyIds() ?? [];
      const primary =
        api?.getEndlessSelectedEnemyIds()[0] ?? roster[0] ?? "grunt";
      const secondary =
        roster.find((id) => id !== primary && id === "javelineer") ??
        roster.find((id) => id !== primary) ??
        primary;
      return { primary, secondary };
    });

    await page.evaluate((secondary) => {
      window.__DEFENSEGAME_E2E__?.api?.toggleEndlessEnemy(secondary);
    }, pair.secondary);

    await page.evaluate(
      ({ primary, secondary, primaryCap, secondaryCap }) => {
        window.__DEFENSEGAME_E2E__?.api?.setEndlessEnemyCap(
          primary,
          primaryCap,
        );
        window.__DEFENSEGAME_E2E__?.api?.setEndlessEnemyCap(
          secondary,
          secondaryCap,
        );
      },
      {
        primary: pair.primary,
        secondary: pair.secondary,
        primaryCap: 5,
        secondaryCap: 3,
      },
    );

    const selected = await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.getEndlessSelectedEnemyIds().sort(),
    );
    expect(selected).toContain(pair.primary);
    expect(selected).toContain(pair.secondary);

    const start = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets()["endless-start"],
    );
    expect(start).toBeTruthy();
    await tapCanvas(page, start!.x, start!.y);

    await expect
      .poll(
        () =>
          page.evaluate(() => ({
            scene: window.__DEFENSEGAME_E2E__?.scene,
            ready: window.__DEFENSEGAME_E2E__?.ready,
            ids: window.__DEFENSEGAME_E2E__?.api?.getEndlessEnemyIds().sort(),
            count: window.__DEFENSEGAME_E2E__?.flags?.enemyCount,
          })),
        { timeout: 30_000 },
      )
      .toMatchObject({
        scene: "Defense",
        ready: true,
        ids: expect.arrayContaining([pair.primary, pair.secondary]),
        count: 8,
      });
  });
});
