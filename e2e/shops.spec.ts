import { expect, type Page, test } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import { getTapTarget, tapCanvas, waitForTapTargets } from "./helpers/touch";

const TRADER = "town-building-town_market_stall";
const BLACKSMITH = "town-building-town_special_moon_brazier";

async function tapTarget(page: Page, id: string): Promise<void> {
  const pt = await getTapTarget(page, id);
  await tapCanvas(page, pt.x, pt.y);
}

function saveField<T>(page: Page, pick: string): Promise<T> {
  return page.evaluate((p) => {
    const save = window.__DEFENSEGAME_E2E__?.api?.getSave() as
      | Record<string, unknown>
      | undefined;
    return p
      .split(".")
      .reduce<unknown>(
        (o, k) => (o as Record<string, unknown> | undefined)?.[k],
        save,
      );
  }, pick) as Promise<T>;
}

async function openShopAndBuyFirst(page: Page, building: string) {
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({ gold: 5000, night: 3 });
  });
  await waitForTapTargets(page, [building]);
  await tapTarget(page, building);
  await waitForTapTargets(page, ["gear-close", "gear-tab-shop", "gear-row-0"]);
  await tapTarget(page, "gear-row-0");
  await waitForTapTargets(page, ["gear-buy"]);
  await tapTarget(page, "gear-buy");
  await expect.poll(() => saveField<number>(page, "gold")).toBeLessThan(5000);
}

test("shops: buy from the trader in the night Market Stall", async ({
  page,
}) => {
  await gotoE2E(page);
  await openShopAndBuyFirst(page, TRADER);
  await expect
    .poll(() => saveField<unknown[]>(page, "gear.items").then((i) => i.length))
    .toBe(1);
  // Stock is saved for the day, minus the item just bought.
  const left = await saveField<unknown[]>(page, "shops.trader");
  expect(left.length).toBeGreaterThan(0);
  await tapTarget(page, "gear-tab-bag");
  await waitForTapTargets(page, ["gear-row-0"]);
  await tapTarget(page, "gear-row-0");
  await waitForTapTargets(page, ["gear-sell"]);
  await tapTarget(page, "gear-close");
});

test("shops: buy from the blacksmith at the Moon Brazier", async ({ page }) => {
  await gotoE2E(page);
  await openShopAndBuyFirst(page, BLACKSMITH);
  await expect
    .poll(() => saveField<unknown[]>(page, "gear.items").then((i) => i.length))
    .toBe(1);
  await tapTarget(page, "gear-close");
});

test("consumables: drink a potion in combat", async ({ page }) => {
  await gotoE2E(page);
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({
      consumables: { minor_healing_potion: 2 },
    });
  });
  // Town keeps its own copy of the save; opening Gear re-reads the registry.
  await waitForTapTargets(page, ["town-gear"]);
  await tapTarget(page, "town-gear");
  await waitForTapTargets(page, ["gear-close"]);
  await tapTarget(page, "gear-close");
  await startDefense(page);
  await waitForTapTargets(page, ["defense-potion"]);
  const hp0 = await page.evaluate(
    () => window.__DEFENSEGAME_E2E__?.api?.getPlayerHp() ?? 0,
  );
  await page.evaluate(() => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.setGodMode(false);
    api?.damagePlayer(30);
  });
  await tapTarget(page, "defense-potion");
  await expect
    .poll(() =>
      page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.getPlayerHp() ?? 0),
    )
    .toBe(hp0);
  // Second (last) potion after the cooldown; the button hides at 0 charges.
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.damagePlayer(30));
  await expect
    .poll(
      async () => {
        await tapTarget(page, "defense-potion");
        return page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.getPlayerHp() ?? 0,
        );
      },
      { intervals: [500], timeout: 10_000 },
    )
    .toBe(hp0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {}),
      ),
    )
    .not.toContain("defense-potion");
});
