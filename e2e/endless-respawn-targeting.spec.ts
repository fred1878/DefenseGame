import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";

test("endless respawns stay targetable after dead cull", async ({ page }) => {
  await gotoE2E(page);

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
        page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.canFocusFirstLivingEnemy() ?? false,
        ),
      { timeout: 10_000 },
    )
    .toBe(true);

  const countBefore = await page.evaluate(() =>
    Number(window.__DEFENSEGAME_E2E__?.flags?.enemyCount ?? 0),
  );
  expect(countBefore).toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.damageFirstLivingEnemy(9999);
  });

  await expect
    .poll(
      async () =>
        page.evaluate(() => window.__DEFENSEGAME_E2E__?.flags?.enemyCount ?? 0),
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(countBefore);

  await expect
    .poll(
      async () =>
        page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.canFocusFirstLivingEnemy() ?? false,
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
});