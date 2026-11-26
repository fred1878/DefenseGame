import { describe, expect, it } from "vitest";
import { createNewSave } from "../../core/GameState";
import {
  brierScore,
  carriedBoost,
  type FightOutcome,
  fightSample,
  fightSummaryMarkdown,
  fitPowerModel,
  logLoss,
  modelLogLoss,
  nightFor,
  savePressure,
  summarizeFights,
  weightSimplex,
} from "./fights";
import { DEFAULT_POWER_MODEL } from "./power";
import { defaultRawData, loadSimData } from "./simData";

const data = loadSimData(defaultRawData());

describe("fights", () => {
  it("counts carried potions and bombs", () => {
    const save = createNewSave();
    const heal = Object.entries(data.consumables.items).find(
      ([, d]) => d.kind === "heal",
    )![0];
    const bomb = Object.entries(data.consumables.items).find(
      ([, d]) => d.kind !== "heal",
    )![0];
    save.consumables = { [heal]: 2, [bomb]: 1, nope: 3, [`${heal}`]: 2 };
    const boost = carriedBoost(data, {
      ...save,
      consumables: { ...save.consumables, empty: 0 },
    });
    expect(boost.healHp).toBe(2 * (data.consumables.items[heal]!.healHp ?? 0));
    expect(boost.bombDamage).toBe(
      data.consumables.items[bomb]!.bomb?.damage ?? 0,
    );
    expect(carriedBoost(data, { ...save, consumables: { [heal]: 0 } })).toEqual(
      {
        healHp: 0,
        bombDamage: 0,
      },
    );
  });

  it("clamps nights and builds a pressure / sample for a save", () => {
    expect(nightFor(data, 0).night).toBe(1);
    expect(nightFor(data, 999).night).toBe(data.nights.length);
    const save = createNewSave();
    const p = savePressure(data, save, DEFAULT_POWER_MODEL);
    expect(p.winChance).toBeGreaterThan(0);
    const s = fightSample(data, save);
    expect(s.night.night).toBe(save.night);
    expect(s.wallHpMax).toBe(save.townWallHpMax);
  });

  it("scores and summarises outcomes", () => {
    const rows: FightOutcome[] = [
      { night: 1, strategy: "a", tier: "p50", predicted: 0.9, won: true },
      { night: 1, strategy: "b", tier: "p50", predicted: 0.2, won: false },
      { night: 2, strategy: "a", tier: "p50", predicted: 0, won: true },
    ];
    expect(logLoss(rows)).toBeGreaterThan(0);
    expect(Number.isFinite(logLoss(rows))).toBe(true);
    expect(logLoss([])).toBe(0);
    expect(brierScore(rows)).toBeCloseTo((0.01 + 0.04 + 1) / 3);
    expect(brierScore([])).toBe(0);
    const s = summarizeFights(rows);
    expect(s.fights).toBe(3);
    expect(s.overall.wins).toBe(2);
    expect(s.byNight.map((c) => c.night)).toEqual([1, 2]);
    expect(s.byStrategy.map((c) => c.strategy)).toEqual(["a", "b"]);
    expect(s.byNightStrategy).toHaveLength(3);
    const md = fightSummaryMarkdown(s);
    expect(md).toContain("| 1 | a | 1 | 90% | 100% |");
    expect(fightSummaryMarkdown(summarizeFights([]))).toContain("real –");
  });

  it("lists weights summing to 1", () => {
    const w = weightSimplex();
    expect(w).toHaveLength(66);
    for (const [o, d, x] of w) expect(o + d + x).toBeCloseTo(1);
  });

  it("fits model knobs to reduce log loss", () => {
    const save = createNewSave();
    const easy = { ...fightSample(data, save), won: true };
    const hard = {
      ...fightSample(data, { ...save, night: data.nights.length }),
      won: false,
    };
    const samples = [easy, easy, hard, hard];
    const start = { ...DEFAULT_POWER_MODEL, steepness: 2 };
    const r = fitPowerModel(samples, start, { steepness: [2, 8] }, 3);
    expect(r.logLoss).toBeLessThanOrEqual(r.startLogLoss);
    expect(r.logLoss).toBeCloseTo(modelLogLoss(samples, r.model));
    // Nothing to improve: stops after the first pass.
    const again = fitPowerModel(samples, r.model, {}, 5);
    expect(again.logLoss).toBeCloseTo(r.logLoss);
    expect(fitPowerModel(samples, start).logLoss).toBeLessThanOrEqual(
      r.startLogLoss,
    );
  });
});
