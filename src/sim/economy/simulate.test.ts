import { describe, expect, it } from "vitest";
import type { SaveGame } from "../../core/save/saveTypes";
import { talentBonus } from "../../talents/talentLogic";
import { DEFAULT_POWER_MODEL, playerPower } from "./power";
import {
  defaultSimOptions,
  emptyRarityCounts,
  nightStreams,
  simulateMany,
  simulateRun,
  STRATEGY_IDS,
  streamSeed,
  type SimOptions,
} from "./simulate";
import { applySetOverride, defaultRawData, loadSimData } from "./simData";

const data = loadSimData(defaultRawData());
const opts = (over: Partial<SimOptions> = {}): SimOptions => ({
  ...defaultSimOptions(data),
  ...over,
});

describe("simulate", () => {
  it("derives independent random streams from the seed", () => {
    expect(streamSeed(1, "win", 3, 1)).toBe(streamSeed(1, "win", 3, 1));
    expect(streamSeed(1, "win", 3, 1)).not.toBe(streamSeed(1, "shops", 3, 1));
    expect(streamSeed(1, "win", 3, 2)).not.toBe(streamSeed(1, "win", 4, 2));
    const a = nightStreams(5, 7, 1);
    const b = nightStreams(5, 7, 1);
    expect([a.win(), a.drops(), a.shops(), a.rerolls()]).toEqual([
      b.win(),
      b.drops(),
      b.shops(),
      b.rerolls(),
    ]);
  });

  it("gives every strategy the same night luck for a seed", () => {
    // Separate win / shop streams: shops cannot shift the night rolls, so a
    // paired seed compares strategies on the same nights.
    const a = simulateRun(
      data,
      opts({ strategy: "balanced", winModel: "fixed", winRate: 0.5 }),
      11,
    );
    const b = simulateRun(
      data,
      opts({ strategy: "no-spend", winModel: "fixed", winRate: 0.5 }),
      11,
    );
    expect(a.records.map((r) => [r.night, r.attempt, r.won])).toEqual(
      b.records.map((r) => [r.night, r.attempt, r.won]),
    );
  });

  it("resolves nights in spawn-group stages and records where they broke", () => {
    const runs = simulateMany(data, opts({ maxAttempts: 40 }), 3, 3);
    const recs = runs.flatMap((r) => r.records);
    expect(recs.some((r) => r.stages > 1)).toBe(true);
    for (const r of recs) {
      expect(r.stages).toBeGreaterThanOrEqual(1);
      expect(r.stageWon).toBeLessThanOrEqual(r.stages);
      expect(r.hpLeft).toBeGreaterThanOrEqual(0);
      expect(r.wallLeft).toBeGreaterThanOrEqual(0);
      if (r.won) expect(r.failedStage).toBeNull();
      else expect(r.failedStage).not.toBeNull();
    }
    expect(recs.filter((r) => !r.won).some((r) => r.stages > 1)).toBe(true);
  });

  it("records purchasing power, deficit nights and the forgone purchase", () => {
    const runs = simulateMany(
      data,
      opts({ strategy: "walls-first", winModel: "fixed", winRate: 1 }),
      1,
      6,
    );
    const recs = runs.flatMap((r) => r.records);
    expect(recs.every((r) => r.purchasingPower >= 0)).toBe(true);
    expect(recs.some((r) => r.deficit)).toBe(true);
    for (const r of recs.filter((x) => x.deficit)) {
      expect(r.deficitGold).toBeGreaterThan(0);
      expect(r.forgoneScore).toBeGreaterThan(0);
    }
    for (const r of recs.filter((x) => !x.deficit)) {
      expect(r.deficitGold).toBe(0);
      expect(r.forgoneScore).toBe(0);
    }
  });

  it("is deterministic for a seed", () => {
    const a = simulateRun(data, opts(), 7);
    const b = simulateRun(data, opts(), 7);
    expect(a).toEqual(b);
    expect(a.records[0]!.night).toBe(1);
    expect(a.records[0]!.attempt).toBe(1);
  });

  it.each(STRATEGY_IDS)("plays a full campaign with %s", (strategy) => {
    const runs = simulateMany(data, opts({ strategy }), 1, 6);
    expect(runs).toHaveLength(6);
    expect(runs.map((r) => r.seed)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const run of runs) {
      expect(run.records.length).toBeGreaterThanOrEqual(data.nights.length);
      for (const r of run.records) {
        expect(r.goldBanked).toBeGreaterThanOrEqual(0);
        expect(r.equippedFromDrops + r.equippedFromShop).toBeLessThanOrEqual(
          r.equippedCount,
        );
      }
    }
    const spent = runs
      .flatMap((r) => r.records)
      .reduce(
        (a, r) => ({
          wall: a.wall + r.spentWall,
          gear: a.gear + r.spentGear,
          pots: a.pots + r.spentConsumables,
          used: a.used + r.consumablesUsed,
        }),
        { wall: 0, gear: 0, pots: 0, used: 0 },
      );
    if (strategy === "no-spend") {
      expect(spent).toEqual({ wall: 0, gear: 0, pots: 0, used: 0 });
    } else {
      expect(spent.gear + spent.wall + spent.pots).toBeGreaterThan(0);
    }
    if (strategy === "walls-first") expect(spent.wall).toBeGreaterThan(0);
    if (strategy === "gear-first") expect(spent.gear).toBeGreaterThan(0);
    if (strategy === "potion-hoarder") {
      expect(spent.pots).toBeGreaterThan(0);
      expect(spent.used).toBeGreaterThan(0);
    }
  });

  it("reports each night's starting save and pressure", () => {
    const seen: Array<{ night: number; chance: number }> = [];
    const r = simulateRun(
      data,
      opts({
        maxAttempts: 3,
        onNightStart: (save, pressure) =>
          seen.push({ night: save.night, chance: pressure.winChance }),
      }),
      5,
    );
    expect(seen.map((s) => s.night)).toEqual(r.records.map((x) => x.night));
    expect(seen.map((s) => s.chance)).toEqual(
      r.records.map((x) => x.pressure.winChance),
    );
  });

  it("uses a fixed win rate when asked", () => {
    const always = simulateRun(
      data,
      opts({ winModel: "fixed", winRate: 1 }),
      3,
    );
    expect(always.finished).toBe(true);
    expect(always.records.every((r) => r.won)).toBe(true);
    expect(always.records).toHaveLength(data.nights.length);
    const never = simulateRun(
      data,
      opts({ winModel: "fixed", winRate: 0, maxAttempts: 5 }),
      3,
    );
    expect(never.finished).toBe(false);
    expect(never.records).toHaveLength(5);
    expect(never.records.every((r) => r.night === 1 && !r.won)).toBe(true);
    // A lost night pays loot.lostNightGoldPct of the reward.
    expect(never.records[0]!.goldEarned).toBe(
      Math.floor(
        (data.nights[0]!.rewardGold * data.loot.lostNightGoldPct) / 100,
      ),
    );
  });

  it("stops after the requested number of nights", () => {
    const run = simulateRun(
      data,
      opts({ winModel: "fixed", winRate: 1, nights: 3 }),
      1,
    );
    expect(run.finished).toBe(true);
    expect(run.records).toHaveLength(3);
  });

  it("keeps the bag and auto-sells drops on a full bag with --no-sell", () => {
    const raw = defaultRawData();
    applySetOverride(raw, "loot.inventoryCapacity=1");
    const small = loadSimData(raw);
    const run = simulateRun(
      small,
      {
        ...defaultSimOptions(small),
        strategy: "no-spend",
        sellSurplus: false,
        winModel: "fixed",
        winRate: 1,
      },
      2,
    );
    const autoSold = run.records.reduce((a, r) => a + r.autoSold, 0);
    expect(autoSold).toBeGreaterThan(0);
    expect(run.records.some((r) => r.bagCount === 1)).toBe(true);
    loadSimData(defaultRawData());
  });

  it("plays the last night again when nights exceed waves.json", () => {
    const run = simulateRun(
      data,
      opts({ winModel: "fixed", winRate: 1, nights: data.nights.length + 1 }),
      1,
    );
    expect(run.records).toHaveLength(data.nights.length + 1);
  });

  it("skips walls when buildings.json has no wall", () => {
    const raw = defaultRawData();
    raw.buildings = {};
    const noWall = loadSimData(raw);
    const run = simulateRun(
      noWall,
      { ...defaultSimOptions(noWall), strategy: "walls-first" },
      1,
    );
    expect(run.records.every((r) => r.spentWall === 0)).toBe(true);
    loadSimData(defaultRawData());
  });

  it("stops buying walls when costByLevel runs out", () => {
    const raw = defaultRawData();
    applySetOverride(raw, "buildings.wall.maxLevel=9");
    applySetOverride(raw, "buildings.wall.costByLevel=[1]");
    const d = loadSimData(raw);
    const run = simulateRun(
      d,
      {
        ...defaultSimOptions(d),
        strategy: "walls-first",
        winModel: "fixed",
        winRate: 1,
      },
      1,
    );
    expect(run.records.at(-1)!.wallLevel).toBe(1);
    loadSimData(defaultRawData());
  });

  it("cannot buy gear with no bag space, and keeps old gear with --no-sell", () => {
    const raw = defaultRawData();
    applySetOverride(raw, "loot.inventoryCapacity=0");
    const d = loadSimData(raw);
    const full = simulateRun(
      d,
      {
        ...defaultSimOptions(d),
        strategy: "gear-first",
        winModel: "fixed",
        winRate: 1,
      },
      1,
    );
    expect(full.records.every((r) => r.spentGear === 0)).toBe(true);
    loadSimData(defaultRawData());
    const keep = simulateRun(
      data,
      opts({
        strategy: "gear-first",
        sellSurplus: false,
        winModel: "fixed",
        winRate: 1,
      }),
      1,
    );
    expect(keep.records.some((r) => r.spentGear > 0)).toBe(true);
    expect(keep.records.at(-1)!.bagCount).toBeGreaterThan(0);
  });

  it("copes with empty shops", () => {
    const raw = defaultRawData();
    applySetOverride(raw, "shops.trader.itemCount=0");
    applySetOverride(raw, "shops.blacksmith.items=[]");
    const d = loadSimData(raw);
    const run = simulateRun(
      d,
      { ...defaultSimOptions(d), winModel: "fixed", winRate: 1 },
      1,
    );
    expect(run.records[0]!.shopItems).toBe(0);
    expect(run.records[0]!.traderMedianPrice).toBe(0);
    loadSimData(defaultRawData());
  });

  it("starts rarity counts at zero", () => {
    expect(Object.values(emptyRarityCounts()).every((v) => v === 0)).toBe(true);
  });

  it("buys shop upgrades and rerolls with the shop strategies", () => {
    const investor = simulateMany(
      data,
      opts({ strategy: "shop-investor" }),
      1,
      4,
    );
    const last = investor.map((r) => r.records.at(-1)!);
    expect(last.some((r) => r.traderLevel > 0 && r.blacksmithLevel > 0)).toBe(
      true,
    );
    expect(
      investor.flatMap((r) => r.records).some((r) => r.spentShops > 0),
    ).toBe(true);
    const reroller = simulateMany(data, opts({ strategy: "reroller" }), 1, 4);
    const recs = reroller.flatMap((r) => r.records);
    expect(recs.some((r) => r.rerolls > 0 && r.spentRerolls > 0)).toBe(true);
    expect(recs.every((r) => r.rerolls <= 3)).toBe(true);
  });

  it("tilts gear picks toward each profile's focus stat", () => {
    const end = (strategy: SimOptions["strategy"]) =>
      simulateMany(data, opts({ strategy }), 1, 6).map(
        (r) => r.records.at(-1)!.powerAfter,
      );
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const tank = end("tank");
    const caster = end("spell-caster");
    expect(avg(tank.map((p) => p.ehp))).toBeGreaterThan(
      avg(caster.map((p) => p.ehp)),
    );
    expect(avg(caster.map((p) => p.spellPowerPct))).toBeGreaterThan(
      avg(tank.map((p) => p.spellPowerPct)),
    );
  });

  it("buys no shop levels when buildings.json has none", () => {
    const raw = defaultRawData();
    applySetOverride(raw, "buildings.trader.maxLevel=0");
    applySetOverride(raw, "buildings.blacksmith.costByLevel=[]");
    const noShops = loadSimData(raw);
    for (const strategy of ["shop-investor", "reroller"] as const) {
      const run = simulateRun(
        noShops,
        { ...defaultSimOptions(noShops), strategy },
        2,
      );
      expect(run.records.every((r) => r.spentShops === 0)).toBe(true);
      expect(run.records.every((r) => r.rerolls === 0)).toBe(true);
    }
    const raw2 = defaultRawData();
    delete (raw2.buildings as Record<string, unknown>).trader;
    const noTrader = loadSimData(raw2);
    const run = simulateRun(
      noTrader,
      { ...defaultSimOptions(noTrader), strategy: "shop-investor" },
      2,
    );
    expect(run.records.every((r) => r.traderLevel === 0)).toBe(true);
    loadSimData(defaultRawData());
  });

  it("spends talent points along each profile's branch", () => {
    const picks = (strategy: SimOptions["strategy"]) =>
      simulateRun(data, opts({ strategy }), 3).talents!;
    const ranged = picks("ranged");
    expect(ranged.earned).toBeGreaterThan(1);
    expect(ranged.ranks.steady_aim).toBeGreaterThan(0);
    const caster = picks("spell-caster");
    expect(caster.ranks.arcane_study).toBeGreaterThan(0);
    const melee = picks("melee-dps");
    expect(melee.ranks.sharpened_edge).toBeGreaterThan(0);
    const spentAll = (t: typeof ranged) =>
      Object.values(t.ranks).reduce((a, b) => a + b, 0);
    expect(spentAll(picks("gear-first"))).toBe(picks("gear-first").earned);
  });

  it("never learns talents with talents off, and loses more power", () => {
    const off = simulateRun(data, opts({ talents: false }), 4);
    expect(off.talents!.ranks).toEqual({});
    expect(off.talents!.earned).toBeGreaterThan(0);
    // With talents on, the learned ranks add power on top of the same gear.
    let last: SaveGame | null = null;
    const on = simulateRun(
      data,
      opts({ onNightStart: (save) => (last = structuredClone(save)) }),
      4,
    );
    expect(Object.keys(on.talents!.ranks).length).toBeGreaterThan(0);
    const save = last as unknown as SaveGame;
    const without = playerPower(data.catalog, save.gear);
    const withTalents = playerPower(
      data.catalog,
      save.gear,
      DEFAULT_POWER_MODEL,
      talentBonus(data.talents, save.talents),
    );
    expect(
      withTalents.weaponDps + withTalents.spellDps + withTalents.ehp,
    ).toBeGreaterThan(without.weaponDps + without.spellDps + without.ehp);
  });
});
