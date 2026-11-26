import { describe, expect, it } from "vitest";
import { createNewSave } from "../core/GameState";
import { normalizeLoot } from "../core/normalizeLoot";
import { gearFixture } from "../test/gearFixture";
import type { ItemDraft } from "./itemGen";
import {
  addLootToSave,
  getLootConfig,
  rarityWeightsAt,
  rollCount,
  rollLoot,
  rollNightDrops,
  setLootConfig,
  type LootConfig,
} from "./loot";
import { createRng } from "./rng";

const catalog = gearFixture();

function lootRaw(): Record<string, unknown> {
  return {
    inventoryCapacity: 2,
    sellBackPct: 50,
    tables: {
      nightWon: {
        minRolls: 2,
        maxRolls: 2,
        minItemLevelOffset: 0,
        maxItemLevelOffset: 0,
        rarityByLevel: [
          { fromLevel: 5, weights: { rare: 1 } },
          { fromLevel: 1, weights: { common: 1 } },
        ],
      },
    },
  };
}

const draft = (baseId: string): ItemDraft => ({
  baseId,
  rarity: "common",
  itemLevel: 1,
  affixes: [],
});

describe("normalizeLoot", () => {
  it("parses tables and sorts rarity bands by level", () => {
    const loot = normalizeLoot(lootRaw());
    expect(loot.inventoryCapacity).toBe(2);
    expect(loot.tables.nightWon?.rarityByLevel.map((b) => b.fromLevel)).toEqual(
      [1, 5],
    );
  });

  it("rejects bad tables", () => {
    const bad = (mut: (t: Record<string, unknown>) => void) => {
      const raw = lootRaw();
      mut((raw.tables as Record<string, Record<string, unknown>>).nightWon!);
      return () => normalizeLoot(raw);
    };
    expect(bad((t) => (t.maxRolls = 0))).toThrow(/maxRolls/);
    expect(bad((t) => (t.rarityByLevel = []))).toThrow(/rarityByLevel/);
    expect(
      bad((t) => (t.rarityByLevel = [{ fromLevel: 1, weights: { shiny: 1 } }])),
    ).toThrow(/Unknown rarity/);
    expect(() => normalizeLoot({ ...lootRaw(), sellBackPct: "x" })).toThrow();
    expect(bad((t) => (t.rollWeights = [1, 2]))).toThrow(
      /rollWeights must list 1/,
    );
    expect(bad((t) => (t.rollWeights = "x"))).toThrow(/rollWeights/);
    expect(bad((t) => (t.rollWeights = [-1]))).toThrow(
      /rollWeights\[0\] must be >= 0/,
    );
    expect(bad((t) => (t.rollWeights = ["x"]))).toThrow(/rollWeights\[0\]/);
  });

  it("parses optional roll-count weights", () => {
    const raw = lootRaw();
    const t = (raw.tables as Record<string, Record<string, unknown>>).nightWon!;
    t.minRolls = 1;
    t.rollWeights = [3, 1];
    expect(normalizeLoot(raw).tables.nightWon?.rollWeights).toEqual([3, 1]);
    expect(normalizeLoot(lootRaw()).tables.nightWon).not.toHaveProperty(
      "rollWeights",
    );
  });
});

describe("loot rolls", () => {
  const loot: LootConfig = normalizeLoot(lootRaw());
  const table = loot.tables.nightWon!;

  it("picks the highest band at or below the level; missing rarities weigh 0", () => {
    expect(rarityWeightsAt(table, 0)).toMatchObject({ common: 1, magic: 0 });
    expect(rarityWeightsAt(table, 7)).toMatchObject({ rare: 1, common: 0 });
  });

  it("rolls the table count at level + offset", () => {
    const drops = rollLoot(catalog, table, 1, createRng(3));
    expect(drops).toHaveLength(2);
    expect(drops.every((d) => d.rarity === "common" && d.itemLevel === 1)).toBe(
      true,
    );
    const high = rollLoot(catalog, table, 6, createRng(3));
    expect(
      high.every((d) => d.rarity === "rare" || d.rarity === "common"),
    ).toBe(true);
    expect(high[0]?.itemLevel).toBe(6);
  });

  it("weights the roll count when rollWeights is set", () => {
    const weighted = {
      ...table,
      minRolls: 1,
      maxRolls: 3,
      rollWeights: [0, 1, 0],
    };
    const rng = createRng(5);
    for (let i = 0; i < 20; i++) expect(rollCount(weighted, rng)).toBe(2);
    const counts = new Set<number>();
    const uniform = { ...table, minRolls: 1, maxRolls: 3 };
    for (let i = 0; i < 60; i++) counts.add(rollCount(uniform, rng));
    expect([...counts].sort()).toEqual([1, 2, 3]);
    expect(rollCount({ ...weighted, rollWeights: [0, 0, 0] }, rng)).toBe(0);
  });

  it("drops nothing when the base pool is empty or the table is missing", () => {
    const empty = { ...catalog, bases: {} };
    expect(rollLoot(empty, table, 1, createRng(1))).toEqual([]);
    expect(rollNightDrops(catalog, false, 1, createRng(1), loot)).toEqual([]);
    expect(rollNightDrops(catalog, true, 1, createRng(1), loot)).toHaveLength(
      2,
    );
  });

  it("adds drops to the bag and sells overflow", () => {
    const save = createNewSave();
    save.gold = 10;
    const r = addLootToSave(
      save,
      [draft("cap"), draft("band"), draft("blade"), draft("ghost")],
      catalog,
      loot,
    );
    expect(r.save.gear.items.map((i) => i.baseId)).toEqual(["cap", "band"]);
    expect(r.soldCount).toBe(2);
    expect(r.soldGold).toBe(10);
    expect(r.save.gold).toBe(20);
  });

  it("uses the active config, falling back to the bundled file", () => {
    expect(getLootConfig().tables.nightWon).toBeDefined();
    setLootConfig(loot);
    expect(getLootConfig()).toBe(loot);
    const r = addLootToSave(createNewSave(), [draft("cap")], catalog);
    expect(r.save.gear.items).toHaveLength(1);
  });
});
