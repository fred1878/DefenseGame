import { describe, expect, it } from "vitest";
import { getGearCatalog } from "../../gear/gearCatalog";
import { getLootConfig } from "../../gear/loot";
import {
  applyOverridesObject,
  applySetOverride,
  deepMerge,
  defaultRawData,
  loadSimData,
  parseOverrideValue,
  waveDifficulties,
} from "./simData";

describe("simData", () => {
  it("loads the shipped data and installs it as the active config", () => {
    const data = loadSimData(defaultRawData());
    expect(data.nights.length).toBeGreaterThanOrEqual(10);
    expect(data.nights[0]!.night).toBe(1);
    expect(data.nights[0]!.rewardGold).toBeGreaterThan(0);
    expect(getGearCatalog()).toBe(data.catalog);
    expect(getLootConfig()).toBe(data.loot);
    expect(data.buildings.wall?.maxLevel).toBeGreaterThan(0);
  });

  it("returns independent copies of the raw files", () => {
    const a = defaultRawData();
    applySetOverride(a, "loot.inventoryCapacity=3");
    expect(
      (defaultRawData().loot as { inventoryCapacity: number })
        .inventoryCapacity,
    ).not.toBe(3);
  });

  it("parses override values as JSON when possible", () => {
    expect(parseOverrideValue("3")).toBe(3);
    expect(parseOverrideValue("true")).toBe(true);
    expect(parseOverrideValue('{"a":1}')).toEqual({ a: 1 });
    expect(parseOverrideValue("hello")).toBe("hello");
  });

  it("applies --set paths including array indices", () => {
    const raw = defaultRawData();
    applySetOverride(raw, "loot.tables.nightWon.maxRolls=4");
    applySetOverride(raw, "loot.tables.nightWon.rollWeights=[4,3,2,1]");
    applySetOverride(raw, "shops.trader.consumables.0.qty = 9");
    applySetOverride(raw, "waves.1.rewardGold=999");
    const data = loadSimData(raw);
    expect(data.loot.tables.nightWon!.maxRolls).toBe(4);
    expect(data.shops.trader.consumables[0]!.qty).toBe(9);
    expect(data.nights[0]!.rewardGold).toBe(999);
  });

  it("rejects bad --set expressions", () => {
    const raw = defaultRawData();
    expect(() => applySetOverride(raw, "loot")).toThrow(/path=value/);
    expect(() => applySetOverride(raw, "nope.a=1")).toThrow(
      /Unknown data file/,
    );
    expect(() => applySetOverride(raw, "loot=1")).toThrow(/key path/);
    expect(() => applySetOverride(raw, "loot.missing.x=1")).toThrow(
      /not found/,
    );
  });

  it("deep-merges overrides objects", () => {
    expect(
      deepMerge({ a: { b: 1, c: 2 }, d: [1] }, { a: { b: 5 }, d: [2], e: 1 }),
    ).toEqual({
      a: { b: 5, c: 2 },
      d: [2],
      e: 1,
    });
    const raw = defaultRawData();
    applyOverridesObject(raw, { loot: { sellBackPct: 25 } });
    expect(loadSimData(raw).loot.sellBackPct).toBe(25);
    expect(() => applyOverridesObject(raw, [])).toThrow(/JSON object/);
    expect(() => applyOverridesObject(raw, { nope: {} })).toThrow(
      /Unknown data file/,
    );
    expect(() => loadSimData({ ...defaultRawData(), buildings: [] })).toThrow(
      /buildings/,
    );
  });

  it("totals enemy HP and damage per night", () => {
    const nights = waveDifficulties(
      {
        "2": {
          rewardGold: 10,
          groups: [
            { atMs: 0, enemyId: "a", count: 2, intervalMs: 1000, hpMul: -1 },
            { atMs: 5000, enemyId: "b", count: 1, intervalMs: 0, hpMul: 2 },
          ],
        },
        "1": { rewardGold: 5 },
        note: { rewardGold: 1 },
      },
      {
        a: { hp: 10, damage: 2, combat: { wall: { damage: 3 } } },
        b: { hp: 50, damage: "x" },
      },
    );
    expect(nights.map((n) => n.night)).toEqual([1, 2]);
    expect(nights[0]).toMatchObject({
      enemyCount: 0,
      totalHp: 0,
      rewardGold: 5,
    });
    expect(nights[1]).toEqual({
      night: 2,
      rewardGold: 10,
      enemyCount: 3,
      totalHp: 120,
      totalDamage: 4,
      totalWallDamage: 6,
      spawnSpanSec: 5,
    });
    expect(() =>
      waveDifficulties({ "1": { groups: [{ enemyId: "z" }] } }, {}),
    ).toThrow(/unknown enemy/);
    expect(() => waveDifficulties(null, {})).toThrow(/must be objects/);
  });
});
