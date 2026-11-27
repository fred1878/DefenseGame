import { describe, expect, it } from "vitest";
import { createEmptyGear } from "../../gear/saveGear";
import {
  DEFAULT_POWER_MODEL,
  nightPressure,
  playerPower,
  winChance,
} from "./power";
import { nightStages, resolveNightStages, stageDifficulty } from "./stages";
import { defaultRawData, loadSimData, type NightDifficulty } from "./simData";

const data = loadSimData(defaultRawData());
const power = playerPower(data.catalog, createEmptyGear());

const night: NightDifficulty = {
  night: 5,
  rewardGold: 30,
  enemyCount: 8,
  totalHp: 800,
  totalDamage: 80,
  totalWallDamage: 40,
  spawnSpanSec: 30,
  stages: [
    {
      enemyCount: 5,
      totalHp: 200,
      totalDamage: 20,
      totalWallDamage: 10,
      startSec: 0,
      spanSec: 10,
    },
    {
      enemyCount: 3,
      totalHp: 600,
      totalDamage: 60,
      totalWallDamage: 30,
      startSec: 20,
      spanSec: 10,
    },
  ],
};

const seq = (values: number[]) => {
  let i = 0;
  return () => values[Math.min(values.length - 1, i++)]!;
};

describe("staged night resolution", () => {
  it("falls back to one stage for a night without groups", () => {
    const plain = { ...night };
    delete plain.stages;
    expect(nightStages(plain)).toHaveLength(1);
    expect(stageDifficulty(plain, nightStages(plain)[0]!).totalHp).toBe(800);
    expect(nightStages(night)).toHaveLength(2);
  });

  it("splits the night's chance across stages and multiplies back", () => {
    const pressure = nightPressure(power, night, 100);
    const out = resolveNightStages(
      power,
      night,
      100,
      DEFAULT_POWER_MODEL,
      { healHp: 0, bombDamage: 0 },
      () => 0,
      pressure,
    );
    expect(out.won).toBe(true);
    expect(out.stages).toHaveLength(2);
    expect(out.failedStage).toBeNull();
    const product = out.stages.reduce((a, s) => a * s.chance, 1);
    expect(product).toBeCloseTo(pressure.winChance, 10);
    expect(out.stages.every((s) => s.won)).toBe(true);
    expect(out.stages.at(-1)!.hpLeft).toBeLessThan(1);
  });

  it("keeps the night chance for a single-stage night", () => {
    const plain = { ...night };
    delete plain.stages;
    const pressure = nightPressure(power, plain, 100);
    const out = resolveNightStages(
      power,
      plain,
      100,
      DEFAULT_POWER_MODEL,
      { healHp: 0, bombDamage: 0 },
      () => 0,
      pressure,
    );
    expect(out.stages[0]!.chance).toBeCloseTo(pressure.winChance, 12);
  });

  it("stops at the stage whose roll fails and names the weakest resource", () => {
    const pressure = nightPressure(power, night, 100);
    // Survive the first stage, fail the second.
    const out = resolveNightStages(
      power,
      night,
      100,
      DEFAULT_POWER_MODEL,
      { healHp: 0, bombDamage: 0 },
      seq([0, 0.999999]),
      pressure,
    );
    expect(out.won).toBe(false);
    expect(out.failedStage).toBe(1);
    expect(out.stages).toHaveLength(2);
    expect(out.failedOn).not.toBeNull();
    expect(["offence", "defence", "wall"]).toContain(out.failedOn);
  });

  it("can fail on the first group", () => {
    const pressure = nightPressure(power, night, 100);
    const out = resolveNightStages(
      power,
      night,
      100,
      DEFAULT_POWER_MODEL,
      { healHp: 0, bombDamage: 0 },
      () => 1,
      pressure,
    );
    expect(out.won).toBe(false);
    expect(out.failedStage).toBe(0);
    expect(out.stages).toHaveLength(1);
  });

  it("weights failure toward the later, riskier group", () => {
    // A long fight: the defence budget is spent by the second group.
    const pressure = nightPressure(power, night, 100);
    expect(pressure.winChance).toBeLessThan(1);
    let late = 0;
    let early = 0;
    for (let i = 1; i <= 400; i++) {
      const rng = createRngish(i);
      const out = resolveNightStages(
        power,
        night,
        100,
        DEFAULT_POWER_MODEL,
        { healHp: 0, bombDamage: 0 },
        rng,
        pressure,
      );
      if (out.won) continue;
      if (out.failedStage === 1) late += 1;
      else early += 1;
    }
    expect(late + early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(0);
    // Chance is a property of the model, not the seed: the loss rate matches it.
    const wins = 400 - late - early;
    expect(wins / 400).toBeCloseTo(pressure.winChance, 0);
  });

  it("is deterministic for a seed", () => {
    const pressure = nightPressure(power, night, 100);
    const a = resolveNightStages(
      power,
      night,
      100,
      DEFAULT_POWER_MODEL,
      { healHp: 0, bombDamage: 0 },
      createRngish(7),
      pressure,
    );
    const b = resolveNightStages(
      power,
      night,
      100,
      DEFAULT_POWER_MODEL,
      { healHp: 0, bombDamage: 0 },
      createRngish(7),
      pressure,
    );
    expect(a).toEqual(b);
  });

  it("splits a certain win and a certain loss", () => {
    const sure: NightDifficulty = {
      ...night,
      totalHp: 0,
      totalDamage: 0,
      totalWallDamage: 0,
      stages: [
        {
          ...night.stages![0]!,
          totalHp: 0,
          totalDamage: 0,
          totalWallDamage: 0,
        },
      ],
    };
    const easy = nightPressure(power, sure, 1e9);
    expect(easy.winChance).toBeGreaterThan(0.99);
    const won = resolveNightStages(
      power,
      sure,
      1e9,
      DEFAULT_POWER_MODEL,
      { healHp: 0, bombDamage: 0 },
      () => 0,
      easy,
    );
    expect(won.won).toBe(true);
    const doomed: NightDifficulty = {
      ...night,
      totalHp: 1e9,
      totalDamage: 1e9,
      totalWallDamage: 1e9,
    };
    const hard = nightPressure(power, doomed, 1);
    expect(hard.winChance).toBeLessThan(0.001);
    const lost = resolveNightStages(
      power,
      doomed,
      1,
      DEFAULT_POWER_MODEL,
      { healHp: 0, bombDamage: 0 },
      () => 1,
      hard,
    );
    expect(lost.won).toBe(false);
    expect(winChance(hard.powerRatio, DEFAULT_POWER_MODEL.steepness)).toBe(
      hard.winChance,
    );
  });
});

/** Local tiny PRNG so this test does not depend on the gear rng's internals. */
function createRngish(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
