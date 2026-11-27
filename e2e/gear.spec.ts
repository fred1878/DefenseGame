import { expect, type Page, test } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import { tapGameButton, waitForTapTargets } from "./helpers/touch";

function tapTargetIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {}),
  );
}

test("gear: open from town, equip a bag item, sell one and close", async ({
  page,
}) => {
  // Many panel taps at software-GL frame rates (~6 fps on CI runners) overrun 90s.
  test.setTimeout(180_000);
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
  await tapGameButton(page, "town-gear");
  await waitForTapTargets(page, [
    "inv-close",
    "inv-slot-meleeWeapon",
    "inv-bag-0",
    "inv-bag-1",
  ]);

  await tapGameButton(page, "inv-bag-0");
  await waitForTapTargets(page, ["inv-equip", "inv-sell"]);
  await tapGameButton(page, "inv-equip");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(
          window.__DEFENSEGAME_E2E__?.api?.getSave()?.gear.equipped ?? {},
        ),
      ),
    )
    .toHaveLength(1);

  // The equipped item is now in its slot; one item is left in the bag.
  await waitForTapTargets(page, ["inv-unequip"]);
  await expect.poll(() => tapTargetIds(page)).not.toContain("inv-bag-1");
  await tapGameButton(page, "inv-bag-0");
  await waitForTapTargets(page, ["inv-sell"]);
  await tapGameButton(page, "inv-sell");
  await expect
    .poll(() =>
      page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.getSave()?.gold),
    )
    .toBeGreaterThan(0);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__DEFENSEGAME_E2E__?.api?.getSave()?.gear.items.length ?? 0,
      ),
    )
    .toBe(1);

  await tapGameButton(page, "inv-tab-consumables");
  await expect.poll(() => tapTargetIds(page)).not.toContain("inv-sell");
  await tapGameButton(page, "inv-close");
  await expect.poll(() => tapTargetIds(page)).not.toContain("inv-close");
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
