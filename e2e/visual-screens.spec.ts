import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import { getTapTarget, tapCanvas, waitForTapTargets } from "./helpers/touch";
import {
  freezeGameLoop,
  installVisualDeterminism,
  waitFrames,
} from "./helpers/visual";

/**
 * Screenshot checks for the main screens (Town, Endless panel with a
 * scrolled roster, Wave planner, Defense, Blacksmith, Inventory). They catch rendering regressions
 * that layout/tap-target tests can't, e.g. the roster list losing its clip mask
 * and drawing over the footer.
 *
 * Determinism: fixed-seed Math.random, game loop frozen before capture, CSS
 * animations disabled, and fonts pinned to the bundled DejaVu Sans (e2e/fonts) so
 * text renders the same on every Linux machine. Baselines live in `visual-screens.spec.ts-snapshots/` and
 * were generated on CI's runner (ubuntu-24.04, Chromium, software WebGL).
 * Update with: `npx playwright test e2e/visual-screens.spec.ts --update-snapshots`
 * (only after checking the diff is intended).
 */

const CLINIC = "town-building-town_special_plague_clinic";
/** Roster scroll offset for the Endless capture: rows are partly cut off at the viewport edges. */
const ROSTER_SCROLL_PX = 130;

const SHOT = {
  // Per-pixel colour tolerance (0..1) absorbs antialiasing noise in text edges.
  threshold: 0.2,
  // Allow 0.2% of pixels (~1.3k of 540×1200) to differ; a clipping/overlap bug changes 20%+.
  maxDiffPixelRatio: 0.002,
  animations: "disabled" as const,
  caret: "hide" as const,
};

test.describe.configure({ mode: "parallel" });

// This spec's browser resolves every font family to e2e/fonts/DejaVuSans.ttf.
test.use({
  launchOptions: {
    env: {
      ...process.env,
      FONTCONFIG_FILE: fileURLToPath(
        new URL("./fonts/fonts.conf", import.meta.url),
      ),
    },
  },
});

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Baselines are Chromium desktop (540×1200) only",
  );
  await installVisualDeterminism(page);
  await gotoE2E(page);
});

async function tapTarget(page: Page, id: string): Promise<void> {
  const pt = await getTapTarget(page, id);
  await tapCanvas(page, pt.x, pt.y);
}

test("visual: town", async ({ page }) => {
  await waitForTapTargets(page, [CLINIC]);
  await waitFrames(page, 30);
  await freezeGameLoop(page);
  await expect(page).toHaveScreenshot("town.png", SHOT);
});

test("visual: endless panel with scrolled roster", async ({ page }) => {
  await page.evaluate(() =>
    window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
  );
  await waitForTapTargets(page, ["endless-close", "endless-start"]);
  const state = await page.evaluate((dy) => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.scrollEndlessEnemyList(dy);
    return api?.getEndlessEnemyListScrollState() ?? null;
  }, ROSTER_SCROLL_PX);
  // The capture is only meaningful if rows really sit outside the list viewport.
  expect(state?.maxScroll ?? 0).toBeGreaterThan(0);
  expect(state?.scrollY ?? 0).toBeGreaterThan(0);
  await waitFrames(page, 20);
  await freezeGameLoop(page);
  await expect(page).toHaveScreenshot("endless-panel-scrolled.png", SHOT);
});

test("visual: wave planner", async ({ page }) => {
  await waitForTapTargets(page, [CLINIC]);
  await tapTarget(page, CLINIC);
  await waitForTapTargets(page, ["wave-planner-start", "wave-planner-close"]);
  await waitFrames(page, 20);
  await freezeGameLoop(page);
  await expect(page).toHaveScreenshot("wave-planner.png", SHOT);
});

test("visual: defense (night won, HUD + world)", async ({ page }) => {
  await startDefense(page);
  await page.evaluate(() => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.setGodMode(true);
    api?.setManualReturnToTown(true);
    api?.setSpawnPlanComplete(true);
    api?.killAllEnemies();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__DEFENSEGAME_E2E__?.api;
          return Boolean(api?.nightEnded() && api.hasReturnButton());
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
  // Let the night-end summary / camera settle before freezing.
  await waitFrames(page, 40);
  await freezeGameLoop(page);
  await expect(page).toHaveScreenshot("defense-night-won.png", SHOT);
});

test("visual: defense (night lost, summary panel)", async ({ page }) => {
  await startDefense(page);
  await page.evaluate(() => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.setManualReturnToTown(true);
    api?.damagePlayer(9999);
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__DEFENSEGAME_E2E__?.api;
          return Boolean(api?.nightEnded() && api.hasReturnButton());
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
  await waitFrames(page, 40);
  await freezeGameLoop(page);
  await expect(page).toHaveScreenshot("defense-night-lost.png", SHOT);
});

const BLACKSMITH = "town-building-town_special_moon_brazier";

test("visual: blacksmith (buy tab, card selected with compare)", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({ gold: 140, night: 2 });
  });
  await waitForTapTargets(page, [BLACKSMITH]);
  await tapTarget(page, BLACKSMITH);
  await waitForTapTargets(page, ["shop-close", "shop-card-0"]);
  await tapTarget(page, "shop-card-0");
  await waitForTapTargets(page, ["shop-buyEquip"]);
  await waitFrames(page, 20);
  await freezeGameLoop(page);
  await expect(page).toHaveScreenshot("blacksmith.png", SHOT);
});

test("visual: inventory (equipped slots, bag and detail)", async ({ page }) => {
  await page.evaluate(() => {
    const item = (
      uid: number,
      baseId: string,
      rarity: "common" | "magic" | "rare",
      lvl: number,
    ) => ({
      uid,
      baseId,
      rarity,
      itemLevel: lvl,
      affixes: [],
    });
    window.__DEFENSEGAME_E2E__?.api?.setSave({
      gold: 260,
      night: 4,
      consumables: { minor_healing_potion: 2 },
      gear: {
        items: [
          item(1, "iron_sword", "common", 3),
          item(2, "leather_cap", "common", 2),
          item(3, "short_bow", "magic", 3),
          item(4, "padded_vest", "rare", 4),
          item(5, "worn_boots", "common", 2),
        ],
        equipped: { meleeWeapon: 1, helm: 2 },
        nextUid: 6,
      },
    });
  });
  await waitForTapTargets(page, ["town-gear"]);
  await tapTarget(page, "town-gear");
  await waitForTapTargets(page, ["inv-close", "inv-bag-0"]);
  await tapTarget(page, "inv-bag-0");
  await waitForTapTargets(page, ["inv-equip"]);
  await waitFrames(page, 20);
  await freezeGameLoop(page);
  await expect(page).toHaveScreenshot("inventory.png", SHOT);
});
