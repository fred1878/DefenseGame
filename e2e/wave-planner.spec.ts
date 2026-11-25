import { expect, type Page, test } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { getTapTarget, tapCanvas, waitForTapTargets } from "./helpers/touch";

const CLINIC = "town-building-town_special_plague_clinic";

function tapTargetIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {}),
  );
}

async function tapTarget(page: Page, id: string): Promise<void> {
  const pt = await getTapTarget(page, id);
  await tapCanvas(page, pt.x, pt.y);
}

async function openPlanner(page: Page): Promise<void> {
  await waitForTapTargets(page, [CLINIC]);
  await tapTarget(page, CLINIC);
  await waitForTapTargets(page, ["wave-planner-start", "wave-planner-close"]);
}

test("wave planner: open from the clinic, close, reopen and start a planned night", async ({
  page,
}) => {
  await gotoE2E(page);

  // The planner roster uses the same playable list as the endless panel;
  // its first row is selected by default (count 1, at 0 ms).
  await page.evaluate(() =>
    window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
  );
  await waitForTapTargets(page, ["endless-close"]);
  const firstEnemy = await page.evaluate(
    () =>
      window.__DEFENSEGAME_E2E__?.api?.getEndlessRosterEnemyIds()[0] ?? null,
  );
  expect(firstEnemy).toBeTruthy();
  await tapTarget(page, "endless-close");
  await expect.poll(() => tapTargetIds(page)).not.toContain("endless-close");

  await openPlanner(page);
  await tapTarget(page, "wave-planner-close");
  await expect
    .poll(() => tapTargetIds(page))
    .not.toContain("wave-planner-start");
  expect(await page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene)).toBe(
    "Town",
  );

  await openPlanner(page);
  await tapTarget(page, "wave-planner-start");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = window.__DEFENSEGAME_E2E__;
          return s?.scene === "Defense" && s.ready === true;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.setGodMode(true));
  expect(
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.isWavePlannerDefense(),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.isEndlessDefense(),
    ),
  ).toBe(false);

  // Only the planned enemy spawns.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.getLivingEnemyDefIds() ?? [],
        ),
      { timeout: 20_000 },
    )
    .toEqual([firstEnemy]);
});
