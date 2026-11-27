import { describe, expect, it } from "vitest";
import buildingsRaw from "../../../public/data/buildings.json";
import { normalizeLoot } from "../../core/data/normalizeLoot";
import { sellValue } from "../../gear/itemStats";
import { blacksmithOffers, offerPrice } from "../../gear/shops";
import { gearFixture } from "../../test/gearFixture";
import {
  inventoryPanelCtx,
  owned,
  panelSave,
  shippedShopCtx,
  shopPanelCtx,
} from "../../test/gearPanelFixture";
import {
  BAG_TILES_PER_PAGE,
  bagEntries,
  carriedConsumables,
  clampPage,
  createGearPanelState,
  entryMatches,
  gearPanelActions,
  listEntries,
  pageCount,
  pageSize,
  reduceGearPanel,
  SHOP_CARDS_PER_PAGE,
  SHOP_CARDS_PER_PAGE_WITH_LOCKED,
  shopEntries,
  sortEntries,
  visibleRows,
  type GearPanelContext,
} from "./gearPanelLogic";

const ctx: GearPanelContext = {
  catalog: gearFixture(),
  loot: normalizeLoot({ inventoryCapacity: 3, sellBackPct: 30, tables: {} }),
};
const smith = shopPanelCtx("blacksmith");
const trader = shopPanelCtx("trader");

describe("gearPanelLogic lists", () => {
  it("pages, sizes and filters", () => {
    expect(pageCount(0, 21)).toBe(1);
    expect(pageCount(22, 21)).toBe(2);
    expect(visibleRows([1, 2, 3, 4], 1, 3)).toEqual([4]);
    expect(pageSize(ctx, false)).toBe(BAG_TILES_PER_PAGE);
    expect(pageSize(smith, false)).toBe(SHOP_CARDS_PER_PAGE);
    expect(pageSize(smith, true)).toBe(SHOP_CARDS_PER_PAGE_WITH_LOCKED);

    const save = panelSave(1, 0, [
      owned(1, "cap"),
      owned(2, "band"),
      owned(3, "blade"),
      owned(4, "idol"),
      owned(5, "gone"),
    ]);
    const bag = bagEntries(ctx, save);
    // Unknown bases are dropped; prices are sell values.
    expect(bag.map((e) => e.key)).toEqual([1, 2, 3, 4]);
    expect(bag[0]!.price).toBe(sellValue(10, 30));
    const kinds = (f: Parameters<typeof entryMatches>[1]) =>
      bag.filter((e) => entryMatches(e, f)).map((e) => e.key);
    expect(kinds("all")).toEqual([1, 2, 3, 4]);
    expect(kinds("weapons")).toEqual([3]);
    expect(kinds("armour")).toEqual([1]);
    expect(kinds("jewellery")).toEqual([2, 4]);
    expect(kinds("consumables")).toEqual([]);
  });

  it("sorts gear by slot, rarity, value and level with consumables last", () => {
    const save = panelSave(1, 0, [
      owned(1, "band", { rarity: "rare", itemLevel: 2 }),
      owned(2, "cap", { itemLevel: 5 }),
      owned(3, "blade"),
    ]);
    const shop = shopEntries(smith, panelSave(5));
    const potion = shop.find((e) => e.kind === "consumable")!;
    const all = [...bagEntries(ctx, save), potion];
    const order = (m: Parameters<typeof sortEntries>[1]) =>
      sortEntries(all, m).map((e) => e.key);
    expect(order("slot")).toEqual([3, 2, 1, potion.key]);
    expect(order("rarity")[0]).toBe(1);
    expect(order("value")[0]).toBe(1);
    expect(order("level")).toEqual([2, 1, 3, potion.key]);
    // Two consumables keep price order.
    const both = shop.filter((e) => e.kind === "consumable");
    expect(sortEntries(both, "slot")).toHaveLength(both.length);
  });

  it("lists shop offers with prices and owned counts", () => {
    const save = panelSave(1);
    save.consumables = { minor_healing_potion: 2 };
    const entries = shopEntries(smith, save);
    expect(entries).toHaveLength(blacksmithOffers(shippedShopCtx, 1).length);
    const pot = entries.find(
      (e) => e.kind === "consumable" && e.def.id === "minor_healing_potion",
    );
    expect(pot).toMatchObject({ count: 2, qty: null });
    const offer = blacksmithOffers(shippedShopCtx, 1)[0]!;
    expect(entries[0]!.price).toBe(
      offerPrice(shippedShopCtx, "blacksmith", offer),
    );
    expect(shopEntries(inventoryPanelCtx, save)).toEqual([]);
    // Rows whose data is gone are skipped.
    save.shops.trader = [
      { kind: "consumable", id: "nope", qty: 1 },
      {
        kind: "item",
        item: { baseId: "nope", rarity: "common", itemLevel: 1, affixes: [] },
        qty: 1,
      },
      { kind: "consumable", id: "fire_bomb", qty: 2 },
    ];
    expect(shopEntries(trader, save).map((e) => e.key)).toEqual([2]);
  });

  it("lists carried consumables for the inventory tab", () => {
    const save = panelSave(1);
    save.consumables = { fire_bomb: 3, healing_potion: 1 };
    const list = carriedConsumables(inventoryPanelCtx, save);
    expect(list.map((e) => e.key)).toEqual([0, 1]);
    const state = { ...createGearPanelState(), view: "consumables" as const };
    expect(listEntries(inventoryPanelCtx, save, state)).toHaveLength(2);
    expect(carriedConsumables(smith, save)).toHaveLength(2);
  });
});

describe("gearPanelLogic reducer", () => {
  it("selects, toggles, filters, sorts and pages", () => {
    const items = Array.from({ length: 25 }, (_, i) => owned(i + 1, "cap"));
    const save = panelSave(1, 0, items, { helm: 1 });
    let state = createGearPanelState();
    const run = (cmd: Parameters<typeof reduceGearPanel>[3]) => {
      state = reduceGearPanel(ctx, save, state, cmd, 21).state;
      return state;
    };
    expect(run({ type: "select", uid: 2 }).selectedUid).toBe(2);
    expect(run({ type: "select", uid: 2 }).selectedUid).toBeNull();
    expect(run({ type: "selectSlot", slot: "helm" }).selectedUid).toBe(1);
    expect(run({ type: "selectSlot", slot: "helm" }).selectedUid).toBeNull();
    expect(run({ type: "selectSlot", slot: "boots" }).selectedUid).toBeNull();
    expect(run({ type: "selectConsumable", id: "x" }).selectedConsumable).toBe(
      "x",
    );
    expect(
      run({ type: "selectConsumable", id: "x" }).selectedConsumable,
    ).toBeNull();
    expect(run({ type: "page", delta: 5 }).page).toBe(1);
    expect(run({ type: "page", delta: -5 }).page).toBe(0);
    run({ type: "page", delta: 1 });
    expect(run({ type: "sort" })).toMatchObject({ sort: "rarity", page: 0 });
    run({ type: "select", uid: 3 });
    expect(run({ type: "filter", filter: "armour" })).toMatchObject({
      filter: "armour",
      selectedUid: null,
    });
    expect(run({ type: "view", view: "consumables" }).view).toBe("consumables");
    expect(run({ type: "tab", tab: "shop" }).tab).toBe("shop");
    expect(clampPage(ctx, save, { ...state, page: 9 }).page).toBe(0);
  });

  it("equips, unequips and sells at the data sell-back rate", () => {
    let save = panelSave(
      1,
      0,
      [owned(1, "cap"), owned(2, "cap"), owned(3, "band")],
      {
        helm: 1,
      },
    );
    let state = createGearPanelState();
    expect(gearPanelActions(ctx, save, state)).toEqual({
      canEquip: false,
      canUnequip: false,
      canSell: false,
      sellPrice: 0,
    });
    for (const type of ["equip", "unequip", "sell"] as const) {
      expect(reduceGearPanel(ctx, save, state, { type }).save).toBe(save);
    }
    state = reduceGearPanel(ctx, save, state, { type: "select", uid: 3 }).state;
    expect(gearPanelActions(ctx, save, state)).toMatchObject({
      canEquip: true,
      sellPrice: sellValue(30, 30),
    });
    expect(reduceGearPanel(ctx, save, state, { type: "unequip" }).save).toBe(
      save,
    );
    ({ save, state } = reduceGearPanel(ctx, save, state, { type: "equip" }));
    expect(save.gear.equipped.ring1).toBe(3);
    expect(state.status).toBe("Equipped Band");
    expect(reduceGearPanel(ctx, save, state, { type: "equip" }).save).toBe(
      save,
    );
    expect(gearPanelActions(ctx, save, state).canUnequip).toBe(true);
    ({ save, state } = reduceGearPanel(ctx, save, state, { type: "unequip" }));
    expect(save.gear.equipped.ring1).toBeUndefined();
    state = reduceGearPanel(ctx, save, state, { type: "select", uid: 2 }).state;
    state = reduceGearPanel(ctx, save, state, { type: "select", uid: 2 }).state;
    state = reduceGearPanel(ctx, save, state, { type: "select", uid: 2 }).state;
    ({ save, state } = reduceGearPanel(ctx, save, state, { type: "sell" }));
    expect(save.gold).toBe(sellValue(10, 30));
    expect(state).toMatchObject({
      selectedUid: null,
      status: "Sold Cap for 3g",
    });
  });

  it("blocks unequip into a full bag", () => {
    const save = panelSave(
      1,
      0,
      [owned(1, "cap"), owned(2, "band"), owned(3, "band"), owned(4, "band")],
      { helm: 1 },
    );
    const state = { ...createGearPanelState(), selectedUid: 1 };
    const r = reduceGearPanel(ctx, save, state, { type: "unequip" });
    expect(r.save).toBe(save);
    expect(r.state.status).toMatch(/Bag is full/);
  });

  it("buys, buys & equips and keeps unlimited offers selected", () => {
    let save = panelSave(1, 5000);
    let state = createGearPanelState("shop");
    expect(reduceGearPanel(smith, save, state, { type: "buy" }).save).toBe(
      save,
    );
    expect(
      reduceGearPanel(inventoryPanelCtx, save, state, { type: "buy" }).save,
    ).toBe(save);
    state = reduceGearPanel(smith, save, state, {
      type: "selectOffer",
      index: 0,
    }).state;
    expect(state.selectedOffer).toBe(0);
    let r = reduceGearPanel(smith, save, state, { type: "buy" });
    expect(r.state.status).toMatch(/^Bought /);
    expect(r.state.selectedOffer).toBe(0);
    expect(r.save.gear.items).toHaveLength(1);
    save = r.save;
    r = reduceGearPanel(smith, save, r.state, { type: "buyEquip" });
    expect(r.state.status).toMatch(/and equipped it$/);
    expect(Object.values(r.save.gear.equipped)).toContain(save.gear.nextUid);
    // A failed buy keeps the selection.
    const poor = { ...r.save, gold: 0 };
    const f = reduceGearPanel(smith, poor, r.state, { type: "buyEquip" });
    expect(f.save).toBe(poor);
    expect(f.state.selectedOffer).toBe(0);
    expect(f.state.status).toMatch(/^Need /);
    expect(
      reduceGearPanel(
        smith,
        save,
        { ...state, selectedOffer: 0 },
        { type: "selectOffer", index: 0 },
      ).state.selectedOffer,
    ).toBeNull();
  });

  it("drops the selection when the last trader unit sells", () => {
    const s = panelSave(1);
    s.shops = {
      trader: [{ kind: "consumable", id: "fire_bomb", qty: 1 }],
      blacksmith: null,
    };
    let state = createGearPanelState("shop");
    state = reduceGearPanel(trader, s, state, {
      type: "selectOffer",
      index: 0,
    }).state;
    const r = reduceGearPanel(trader, s, state, { type: "buyEquip" });
    expect(r.save.shops.trader).toEqual([]);
    expect(r.save.consumables.fire_bomb).toBe(1);
    expect(r.state.selectedOffer).toBeNull();
  });

  it("upgrades and rerolls through the reducer at data prices", () => {
    const costs = buildingsRaw.trader.costByLevel;
    const s = panelSave(2, 1000);
    const state = createGearPanelState("shop");
    expect(
      reduceGearPanel(trader, s, state, { type: "upgradeShop" }).save,
    ).toBe(s);
    expect(reduceGearPanel(smith, s, state, { type: "reroll" }).save).toBe(s);
    const up = shopPanelCtx("trader", true);
    const r = reduceGearPanel(up, s, state, { type: "upgradeShop" });
    expect(r.save.buildings.trader).toBe(1);
    expect(r.save.gold).toBe(1000 - costs[0]!);
    expect(r.save.shops.trader).not.toBeNull();
    const rr = reduceGearPanel(up, r.save, r.state, { type: "reroll" });
    const reroll = r.save.gold - rr.save.gold;
    expect(reroll).toBeGreaterThan(0);
    expect(rr.state.status).toBe(`New stock for ${reroll}g`);
    const poor = { ...rr.save, gold: 0 };
    expect(
      reduceGearPanel(up, poor, rr.state, { type: "upgradeShop" }).state.status,
    ).toBe(`Need ${costs[1]}g (have 0g)`);
    // Default rng when none is given.
    const noRng: GearPanelContext = {
      ...trader,
      shop: { id: "trader", ctx: shippedShopCtx, buildings: buildingsRaw },
    };
    const d = reduceGearPanel(noRng, s, state, { type: "upgradeShop" });
    expect(
      reduceGearPanel(noRng, d.save, d.state, { type: "reroll" }).save.gold,
    ).toBeLessThan(d.save.gold);
  });
});
