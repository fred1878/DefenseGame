import { describe, expect, it } from "vitest";
import {
  defaultSimOptions,
  emptyRarityCounts,
  simulateMany,
  simulateRun,
  STRATEGY_IDS,
  type SimOptions,
} from "./simulate";
import { applySetOverride, defaultRawData, loadSimData } from "./simData";

const data = loadSimData(defaultRawData());
const opts = (over: Partial<SimOptions> = {}): SimOptions => ({
  ...defaultSimOptions(data),
  ...over,
});

describe("simulate", () => {
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
    const on = simulateRun(data, opts(), 4);
    // Compare at the last night both runs reached (talent points buy
    // armour and spell power on top of the same kind of gear).
    const night = Math.min(
      on.records[on.records.length - 1]!.night,
      off.records[off.records.length - 1]!.night,
    );
    const at = (r: typeof on) =>
      r.records.filter((x) => x.night === night).at(-1)!;
    expect(at(on).powerAfter.ehp).toBeGreaterThan(at(off).powerAfter.ehp);
    expect(at(on).powerAfter.spellDps).toBeGreaterThan(
      at(off).powerAfter.spellDps,
    );
  });
});
