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
  await waitForTapTargets(page, ["shop-close", "shop-tab-sell", "shop-card-0"]);
  await tapTarget(page, "shop-card-0");
  await waitForTapTargets(page, ["shop-buy", "shop-buyEquip"]);
  await tapTarget(page, "shop-buy");
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
  await tapTarget(page, "shop-tab-sell");
  await waitForTapTargets(page, ["shop-card-0"]);
  await tapTarget(page, "shop-card-0");
  await waitForTapTargets(page, ["shop-sell", "shop-equip"]);
  await tapTarget(page, "shop-close");
});

test("shops: buy from the blacksmith at the Moon Brazier", async ({ page }) => {
  await gotoE2E(page);
  await openShopAndBuyFirst(page, BLACKSMITH);
  await expect
    .poll(() => saveField<unknown[]>(page, "gear.items").then((i) => i.length))
    .toBe(1);
  // Forge stock is unlimited, so the card stays selected after a buy;
  // Buy & Equip puts the next copy straight into its slot.
  await waitForTapTargets(page, ["shop-buyEquip"]);
  await tapTarget(page, "shop-buyEquip");
  await expect
    .poll(() =>
      saveField<Record<string, number>>(page, "gear.equipped").then(
        (e) => Object.keys(e ?? {}).length,
      ),
    )
    .toBe(1);
  await tapTarget(page, "shop-close");
});

test("shops: upgrade the trader, then pay to reroll its stock", async ({
  page,
}) => {
  await gotoE2E(page);
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({ gold: 500, night: 3 });
  });
  await waitForTapTargets(page, [TRADER]);
  await tapTarget(page, TRADER);
  // Upgrade / Reroll sit in the action bar while no card is selected.
  await waitForTapTargets(page, ["shop-upgrade", "shop-card-0"]);
  await tapTarget(page, "shop-upgrade");
  await expect.poll(() => saveField<number>(page, "buildings.trader")).toBe(1);
  await expect.poll(() => saveField<number>(page, "gold")).toBeLessThan(500);
  const afterUpgrade = await saveField<number>(page, "gold");
  await waitForTapTargets(page, ["shop-reroll"]);
  await tapTarget(page, "shop-reroll");
  await expect
    .poll(() => saveField<number>(page, "gold"))
    .toBeLessThan(afterUpgrade);
  await tapTarget(page, "shop-close");
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
  await waitForTapTargets(page, ["inv-close"]);
  await tapTarget(page, "inv-close");
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

test("shops: sell a bag item to a trader buy request on the Wants tab", async ({
  page,
}) => {
  await gotoE2E(page);
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({
      gold: 0,
      night: 3,
      gear: {
        items: [
          {
            uid: 1,
            baseId: "rusty_sword",
            rarity: "common",
            itemLevel: 2,
            affixes: [],
          },
        ],
        equipped: {},
        nextUid: 2,
      },
      shops: {
        trader: null,
        blacksmith: null,
        requests: [
          { kind: "base", baseId: "rusty_sword" },
          { kind: "unique", uniqueId: "worldsplitter" },
        ],
      },
    });
  });
  await waitForTapTargets(page, [TRADER]);
  await tapTarget(page, TRADER);
  await waitForTapTargets(page, ["shop-tab-wants"]);
  await tapTarget(page, "shop-tab-wants");
  await waitForTapTargets(page, ["shop-card-0", "shop-card-1"]);
  await tapTarget(page, "shop-card-0");
  await waitForTapTargets(page, ["shop-fill"]);
  await tapTarget(page, "shop-fill");
  await expect.poll(() => saveField<number>(page, "gold")).toBeGreaterThan(0);
  await expect
    .poll(() =>
      saveField<unknown[]>(page, "shops.requests").then((r) => r.length),
    )
    .toBe(1);
  await expect
    .poll(() => saveField<unknown[]>(page, "gear.items").then((i) => i.length))
    .toBe(0);
  await tapTarget(page, "shop-close");
});
