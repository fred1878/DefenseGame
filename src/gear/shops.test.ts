import { describe, expect, it } from "vitest";
import consumablesRaw from "../../public/data/consumables.json";
import itemsRaw from "../../public/data/items.json";
import lootRaw from "../../public/data/loot.json";
import shopsRaw from "../../public/data/shops.json";
import { createNewSave } from "../core/GameState";
import { normalizeConsumables } from "../core/normalizeConsumables";
import { normalizeItems } from "../core/normalizeItems";
import { normalizeLoot } from "../core/normalizeLoot";
import { normalizeShops } from "../core/normalizeShops";
import type { SaveGame } from "../core/saveTypes";
import { createRng } from "./rng";
import {
  blacksmithOffers,
  buyOffer,
  defaultShopContext,
  ensureShopStock,
  getShopsConfig,
  nextBlacksmithUnlock,
  blacksmithAt,
  normalizeSaveShops,
  offerPrice,
  rerollTrader,
  rollBlacksmithStock,
  rollTraderStock,
  shopLevel,
  shopMaxLevel,
  traderAt,
  setShopsConfig,
  shopOffers,
  shopTitle,
  type ShopContext,
} from "./shops";

const catalog = normalizeItems(itemsRaw);
const ctx: ShopContext = {
  catalog,
  consumables: normalizeConsumables(consumablesRaw),
  shops: normalizeShops(shopsRaw),
  loot: normalizeLoot(lootRaw),
};

function richSave(night = 1): SaveGame {
  const s = createNewSave();
  s.night = night;
  s.gold = 10_000;
  return s;
}

describe("shops", () => {
  it("falls back to the bundled config and builds a default context", () => {
    expect(getShopsConfig().trader.title).toBe("Trader");
    const custom = {
      ...ctx.shops,
      trader: { ...ctx.shops.trader, title: "T" },
    };
    setShopsConfig(custom);
    expect(defaultShopContext(catalog).shops.trader.title).toBe("T");
    setShopsConfig(ctx.shops);
    expect(shopTitle(ctx, "blacksmith")).toBe("Blacksmith");
  });

  it("rolls trader stock around the night level, deterministic by seed", () => {
    const a = rollTraderStock(ctx, 4, createRng(7));
    const b = rollTraderStock(ctx, 4, createRng(7));
    expect(a).toEqual(b);
    const items = a.filter((o) => o.kind === "item");
    expect(items).toHaveLength(ctx.shops.trader.itemCount);
    for (const o of items) {
      if (o.kind !== "item") continue;
      expect(o.item.itemLevel).toBeGreaterThanOrEqual(4);
      expect(o.item.itemLevel).toBeLessThanOrEqual(6);
      expect(o.qty).toBe(1);
    }
    // 100% chance row always appears.
    expect(
      a.some((o) => o.kind === "consumable" && o.id === "minor_healing_potion"),
    ).toBe(true);
  });

  it("skips unknown consumables and nights below 1 clamp to level 1", () => {
    const c: ShopContext = {
      ...ctx,
      shops: {
        ...ctx.shops,
        trader: {
          ...ctx.shops.trader,
          minItemLevelOffset: -5,
          maxItemLevelOffset: -5,
          consumables: [{ id: "ghost", qty: 1, chancePct: 100 }],
        },
      },
    };
    const stock = rollTraderStock(c, 1, createRng(1));
    expect(
      stock.every((o) => o.kind === "item" && o.item.itemLevel === 1),
    ).toBe(true);
  });

  it("stocks the trader only when empty", () => {
    const save = richSave(2);
    const stocked = ensureShopStock(save, ctx, createRng(3));
    expect(stocked.shops.trader?.length).toBeGreaterThan(0);
    // Level 0 blacksmith has no masterwork stock.
    expect(stocked.shops.blacksmith).toEqual([]);
    expect(ensureShopStock(stocked, ctx, createRng(9))).toBe(stocked);
    expect(shopOffers(stocked, ctx, "trader")).toBe(stocked.shops.trader);
    expect(shopOffers(save, ctx, "trader")).toEqual([]);
  });

  it("unlocks blacksmith stock by night", () => {
    const n1 = blacksmithOffers(ctx, 1);
    const n9 = blacksmithOffers(ctx, 9);
    expect(n9.length).toBeGreaterThan(n1.length);
    expect(n1.every((o) => o.qty === null)).toBe(true);
    expect(nextBlacksmithUnlock(ctx, 1)).toBe(2);
    expect(nextBlacksmithUnlock(ctx, 99)).toBeNull();
    const missing: ShopContext = {
      ...ctx,
      shops: {
        ...ctx.shops,
        blacksmith: {
          ...ctx.shops.blacksmith,
          items: [{ baseId: "ghost", unlockNight: 1 }],
          consumables: [{ id: "ghost", unlockNight: 1 }],
        },
      },
    };
    expect(blacksmithOffers(missing, 5)).toEqual([]);
    expect(shopOffers(richSave(1), ctx, "blacksmith")).toEqual(n1);
  });

  it("prices offers with the shop markup", () => {
    const potion = {
      kind: "consumable" as const,
      id: "minor_healing_potion",
      qty: 1,
    };
    expect(offerPrice(ctx, "blacksmith", potion)).toBe(20);
    expect(offerPrice(ctx, "trader", potion)).toBe(25);
    expect(offerPrice(ctx, "trader", { ...potion, id: "ghost" })).toBeNull();
    const item = blacksmithOffers(ctx, 1)[0]!;
    expect(offerPrice(ctx, "blacksmith", item)).toBeGreaterThan(0);
    if (item.kind !== "item") throw new Error("expected item");
    const ghost = { ...item, item: { ...item.item, baseId: "ghost" } };
    expect(offerPrice(ctx, "blacksmith", ghost)).toBeNull();
  });

  it("buys blacksmith items and consumables with checks", () => {
    let save = richSave(1);
    const offers = blacksmithOffers(ctx, 1);
    const itemIdx = offers.findIndex((o) => o.kind === "item");
    const potIdx = offers.findIndex((o) => o.kind === "consumable");
    const r = buyOffer(save, ctx, "blacksmith", itemIdx);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/^Bought /);
    expect(r.save.gear.items).toHaveLength(1);
    expect(r.save.gold).toBeLessThan(save.gold);
    save = r.save;
    for (let i = 0; i < 5; i++)
      save = buyOffer(save, ctx, "blacksmith", potIdx).save;
    expect(save.consumables.minor_healing_potion).toBe(5);
    expect(buyOffer(save, ctx, "blacksmith", potIdx).message).toMatch(
      /carry more/,
    );
    expect(buyOffer(save, ctx, "blacksmith", 999).message).toBe("Sold out");
    const poor = { ...save, gold: 0 };
    expect(buyOffer(poor, ctx, "blacksmith", itemIdx).message).toMatch(
      /^Need /,
    );
    const tiny = { ...ctx, loot: { ...ctx.loot, inventoryCapacity: 1 } };
    expect(buyOffer(save, tiny, "blacksmith", itemIdx).message).toMatch(
      /Bag is full/,
    );
    const gone = {
      ...ctx,
      consumables: { items: {} },
    };
    const noPotions: ShopContext = {
      ...gone,
      shops: ctx.shops,
    };
    expect(
      blacksmithOffers(noPotions, 1).some((o) => o.kind === "consumable"),
    ).toBe(false);
  });

  it("decrements and removes trader stock", () => {
    let save = richSave(1);
    save.shops = {
      trader: [
        { kind: "consumable", id: "fire_bomb", qty: 2 },
        { kind: "consumable", id: "ghost", qty: 1 },
        { kind: "consumable", id: "frost_bomb", qty: 0 },
      ],
      blacksmith: null,
    };
    save = buyOffer(save, ctx, "trader", 0).save;
    expect(save.shops.trader![0]!.qty).toBe(1);
    save = buyOffer(save, ctx, "trader", 0).save;
    expect(save.shops.trader).toHaveLength(2);
    expect(save.consumables.fire_bomb).toBe(2);
    expect(buyOffer(save, ctx, "trader", 0).message).toBe(
      "No longer available",
    );
    expect(buyOffer(save, ctx, "trader", 1).message).toBe("Sold out");
    // Item offers name the item and drop out of stock.
    const item = rollTraderStock(ctx, 1, createRng(2)).find(
      (o) => o.kind === "item",
    )!;
    save.shops = { trader: [item], blacksmith: null };
    const r = buyOffer(save, ctx, "trader", 0);
    expect(r.ok).toBe(true);
    expect(r.save.shops.trader).toEqual([]);
  });

  it("normalizes saved shop state", () => {
    expect(normalizeSaveShops(null)).toEqual({
      trader: null,
      blacksmith: null,
    });
    expect(normalizeSaveShops({ trader: "x" })).toEqual({
      trader: null,
      blacksmith: null,
    });
    expect(
      normalizeSaveShops({
        blacksmith: [{ kind: "consumable", id: "a", qty: 1 }],
      }).blacksmith,
    ).toHaveLength(1);
    expect(
      normalizeSaveShops({
        trader: [
          { kind: "consumable", id: "a", qty: 1 },
          { kind: "item", item: { baseId: "b" }, qty: null },
          { kind: "item", item: {}, qty: 1 },
          { kind: "consumable", id: "c", qty: "1" },
          null,
          { kind: "other" },
        ],
      }).trader,
    ).toHaveLength(2);
  });

  it("stacks upgrade level rows and caps the saved level", () => {
    const save = richSave(1);
    expect(shopLevel(save, ctx, "trader")).toBe(0);
    save.buildings.trader = 99;
    expect(shopLevel(save, ctx, "trader")).toBe(shopMaxLevel(ctx, "trader"));
    save.buildings.trader = -2;
    expect(shopLevel(save, ctx, "trader")).toBe(0);
    const t0 = traderAt(ctx, 0);
    const t2 = traderAt(ctx, 2);
    expect(t0.rerollCost).toBe(0);
    expect(t2.itemCount).toBeGreaterThan(t0.itemCount);
    expect(t2.priceMulPct).toBeLessThan(t0.priceMulPct);
    // Level 1 row does not set priceMulPct, so it keeps the base value.
    expect(traderAt(ctx, 1).priceMulPct).toBe(t0.priceMulPct);
    expect(blacksmithAt(ctx, 0).stockCount).toBe(0);
    expect(blacksmithAt(ctx, 3).unlockNightsEarly).toBeGreaterThan(0);
  });

  it("rolls blacksmith masterworks and sells them from saved stock", () => {
    const stock = rollBlacksmithStock(ctx, 5, createRng(2), 3);
    expect(stock).toHaveLength(blacksmithAt(ctx, 3).stockCount);
    expect(
      stock.every(
        (o) => o.kind === "item" && o.qty === 1 && o.item.rarity !== "common",
      ),
    ).toBe(true);
    expect(rollBlacksmithStock(ctx, 5, createRng(2))).toEqual([]);
    const save = richSave(5);
    save.buildings.blacksmith = 3;
    save.shops = { trader: null, blacksmith: stock };
    const offers = shopOffers(save, ctx, "blacksmith");
    expect(offers.slice(0, stock.length)).toEqual(stock);
    // Masterworks are priced at the level's blacksmith discount.
    const listPrice = offerPrice(ctx, "blacksmith", offers[0]!)!;
    const paid = offerPrice(ctx, "blacksmith", offers[0]!, 3)!;
    expect(paid).toBeLessThan(listPrice);
    const r = buyOffer(save, ctx, "blacksmith", 0);
    expect(r.ok).toBe(true);
    expect(r.save.gold).toBe(save.gold - paid);
    expect(r.save.shops.blacksmith).toHaveLength(stock.length - 1);
    // Upgrades unlock catalogue rows early.
    expect(blacksmithOffers(ctx, 1, 3).length).toBeGreaterThan(
      blacksmithOffers(ctx, 1).length,
    );
    expect(nextBlacksmithUnlock(ctx, 1, 3)).toBe(3);
    expect(nextBlacksmithUnlock(ctx, 99, 3)).toBeNull();
  });

  it("rerolls the trader for gold once upgraded", () => {
    const save = richSave(3);
    expect(rerollTrader(save, ctx, createRng(1)).message).toMatch(/Upgrade/);
    save.buildings.trader = 1;
    const cost = traderAt(ctx, 1).rerollCost;
    const r = rerollTrader(save, ctx, createRng(1));
    expect(r.ok).toBe(true);
    expect(r.save.gold).toBe(save.gold - cost);
    expect(r.save.shops.trader!.filter((o) => o.kind === "item")).toHaveLength(
      traderAt(ctx, 1).itemCount,
    );
    save.gold = cost - 1;
    expect(rerollTrader(save, ctx, createRng(1)).message).toBe(
      `Need ${cost}g (have ${cost - 1}g)`,
    );
  });

  it("skips stock rows when no base can roll", () => {
    const empty: ShopContext = {
      ...ctx,
      catalog: { ...catalog, bases: {} },
    };
    expect(rollBlacksmithStock(empty, 5, createRng(1), 3)).toEqual([]);
    expect(
      rollTraderStock(empty, 5, createRng(1)).every(
        (o) => o.kind === "consumable",
      ),
    ).toBe(true);
  });
});
