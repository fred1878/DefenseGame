import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { getTapTarget, tapCanvas } from "./helpers/touch";

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
});