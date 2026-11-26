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
});
