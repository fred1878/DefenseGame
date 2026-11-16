import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { getTapTarget, tapCanvas, waitForTapTargets } from "./helpers/touch";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 1200;
const VIEWPORT_MARGIN = 8;

test("endless training opens from Haunted Well and spawns chosen enemy", async ({
  page,
}) => {
  await gotoE2E(page);
  const target = await getTapTarget(
    page,
    "town-building-town_special_haunted_well",
  );
  await tapCanvas(page, target.x, target.y);
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen() ?? false,
        ),
      { timeout: 5_000 },
    )
    .toBe(true);

  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.startEndless("grunt");
  });

  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.scene === "Defense" &&
            window.__DEFENSEGAME_E2E__?.ready === true,
        ),
      { timeout: 30_000 },
    )
    .toBe(true);

  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          endless: window.__DEFENSEGAME_E2E__?.api?.isEndlessDefense(),
          enemyId: window.__DEFENSEGAME_E2E__?.api?.getEndlessEnemyId(),
          count: window.__DEFENSEGAME_E2E__?.flags?.enemyCount,
        })),
      { timeout: 10_000 },
    )
    .toEqual({ endless: true, enemyId: "grunt", count: 1 });

  expect(
    await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.hasLeaveEndlessButton(),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.hasReturnButton(),
    ),
  ).toBe(false);

  await waitForTapTargets(page, ["defense-leave-endless"]);
  const leave = await getTapTarget(page, "defense-leave-endless");
  expect(leave.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
  expect(leave.x).toBeLessThanOrEqual(GAME_WIDTH - VIEWPORT_MARGIN);
  expect(leave.y).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
  expect(leave.y).toBeLessThanOrEqual(GAME_HEIGHT - VIEWPORT_MARGIN);
});