import { expect, type Page, test } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import { getTapTarget, tapCanvas, waitForTapTargets } from "./helpers/touch";

async function tapTarget(page: Page, id: string): Promise<void> {
  const pt = await getTapTarget(page, id);
  await tapCanvas(page, pt.x, pt.y);
}

function tapTargetIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {}),
  );
}

test("gear: open from town, equip a bag item, sell one and close", async ({
  page,
}) => {
  await gotoE2E(page);
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({
      gold: 0,
      gear: {
        items: [
          {
            uid: 1,
            baseId: "iron_sword",
            rarity: "magic",
            itemLevel: 2,
            affixes: [],
          },
          {
            uid: 2,
            baseId: "leather_cap",
            rarity: "common",
            itemLevel: 1,
            affixes: [],
          },
        ],
        equipped: {},
        nextUid: 3,
      },
    });
  });
  await waitForTapTargets(page, ["town-gear"]);
  await tapTarget(page, "town-gear");
  await waitForTapTargets(page, ["gear-close", "gear-row-0", "gear-row-1"]);

  await tapTarget(page, "gear-row-0");
  await waitForTapTargets(page, ["gear-equip"]);
  await tapTarget(page, "gear-equip");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(
          window.__DEFENSEGAME_E2E__?.api?.getSave()?.gear.equipped ?? {},
        ),
      ),
    )
    .toHaveLength(1);

  await tapTarget(page, "gear-row-0");
  await tapTarget(page, "gear-sell");
  await expect
    .poll(() =>
      page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.getSave()?.gold),
    )
    .toBeGreaterThan(0);

  await tapTarget(page, "gear-close");
  await expect.poll(() => tapTargetIds(page)).not.toContain("gear-close");
  await expect.poll(() => tapTargetIds(page)).toContain("town-gear");
});

test("gear: a won night drops loot into the bag", async ({ page }) => {
  await gotoE2E(page);
  await startDefense(page);
  await page.evaluate(() => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.setGodMode(true);
    api?.setSpawnPlanComplete(true);
    api?.killAllEnemies();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = window.__DEFENSEGAME_E2E__;
          return s?.scene === "Town"
            ? (s.api?.getSave()?.gear.items.length ?? 0)
            : 0;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
});
