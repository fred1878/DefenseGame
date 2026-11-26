import { describe, expect, it } from "vitest";
import shopsRaw from "../../public/data/shops.json";
import { normalizeShops } from "./normalizeShops";

type Raw = {
  trader: Record<string, unknown>;
  blacksmith: Record<string, unknown>;
};
const clone = () => JSON.parse(JSON.stringify(shopsRaw)) as Raw;

describe("normalizeShops", () => {
  it("accepts the shipped file", () => {
    const cfg = normalizeShops(shopsRaw);
    expect(cfg.trader.itemCount).toBeGreaterThan(0);
    expect(cfg.blacksmith.items[0]).toHaveProperty("baseId");
    expect(cfg.blacksmith.consumables[0]).toHaveProperty("id");
  });

  it("rejects bad data", () => {
    expect(() => normalizeShops({})).toThrow(/shops.trader/);
    const a = clone();
    a.trader.rarityWeights = { shiny: 1 };
    expect(() => normalizeShops(a)).toThrow(/rarityWeights/);
    const b = clone();
    b.trader.consumables = [{ id: "x", qty: 1 }];
    expect(() => normalizeShops(b)).toThrow(/chancePct/);
    const c = clone();
    c.blacksmith.items = [{ baseId: "x" }];
    expect(() => normalizeShops(c)).toThrow(/unlockNight/);
    const d = clone();
    delete d.blacksmith.title;
    expect(() => normalizeShops(d)).toThrow(/title/);
  });

  it("parses upgrade levels and fills defaults", () => {
    const cfg = normalizeShops(shopsRaw);
    expect(cfg.trader.levels.length).toBeGreaterThan(0);
    expect(cfg.trader.levels[0]).toHaveProperty("rerollCost");
    expect(cfg.blacksmith.levels[0]).toHaveProperty("stockCount");
    // Rarities missing from shop weights never roll.
    expect(cfg.blacksmith.levels[0]!.stockRarityWeights?.common).toBe(0);
    const bare = clone();
    for (const k of ["levels", "rerollCost"]) delete bare.trader[k];
    for (const k of [
      "levels",
      "stockCount",
      "stockItemLevelOffset",
      "stockRarityWeights",
      "unlockNightsEarly",
    ])
      delete bare.blacksmith[k];
    const d = normalizeShops(bare);
    expect(d.trader).toMatchObject({ rerollCost: 0, levels: [] });
    expect(d.blacksmith).toMatchObject({
      stockCount: 0,
      stockItemLevelOffset: 0,
      unlockNightsEarly: 0,
      levels: [],
    });
    expect(d.blacksmith.stockRarityWeights.magic).toBe(1);
    const bad = clone();
    bad.trader.levels = [{ itemCount: "x" }];
    expect(() => normalizeShops(bad)).toThrow(/levels\[0\]\.itemCount/);
    const badW = clone();
    badW.blacksmith.levels = [{ stockRarityWeights: { shiny: 1 } }];
    expect(() => normalizeShops(badW)).toThrow(/stockRarityWeights/);
    const notArr = clone();
    notArr.trader.levels = 3;
    expect(() => normalizeShops(notArr)).toThrow(/levels/);
  });
});
