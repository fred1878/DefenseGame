import type { Rng } from "../../gear/rng";
import {
  nightPressure,
  winChance,
  type ConsumableBoost,
  type NightPressure,
  type PlayerPower,
  type PowerModel,
} from "./power";
import type { NightDifficulty, NightStage } from "./simData";

/**
 * Ordered, sub-night win resolution.
 *
 * One Bernoulli per night hides *where* a night was lost: a player who dies on
 * the last spawn group and one who never gets going look the same. The sim
 * therefore replays the night's spawn groups in order and rolls survival per
 * stage.
 *
 * The overall night chance stays the model's chance (`nightPressure`), so the
 * calibration against real fights is unchanged: the night's failure
 * probability is split across stages in proportion to each stage's risk (its
 * remaining resource margins × its share of the wave's HP), and the stage
 * chances multiply back to the night chance. What the stages add is an ordered
 * story (which group broke you, on which resource, how much HP and wall you
 * had left) and resource carry-over between groups, so a thin defence fails
 * late and a slow offence fails early.
 */
export type StageOutcome = {
  /** 0-based spawn-group index. */
  index: number;
  /** Share of the night's enemy HP this stage spawns. */
  hpShare: number;
  /** Chance of surviving this stage; the product over stages is the night chance. */
  chance: number;
  won: boolean;
  offenceRatio: number;
  defenceRatio: number;
  wallRatio: number;
  /** Share of the night's defence budget left after this stage. */
  hpLeft: number;
  /** Share of the wall's HP left after this stage. */
  wallLeft: number;
};

export type NightOutcome = {
  won: boolean;
  /** Stages attempted (stops at the one that was lost). */
  stages: StageOutcome[];
  /** 0-based index of the lost stage, or null when the night was won. */
  failedStage: number | null;
  /** The resource the night was lost on. */
  failedOn: "offence" | "defence" | "wall" | null;
  /** Defence budget and wall HP left after the last attempted stage (shares). */
  hpLeft: number;
  wallLeft: number;
};

/** Probability clamp for the hazard maths (0 and 1 are limits, not inputs). */
const EPS = 1e-6;
const clampP = (p: number) => Math.min(1 - EPS, Math.max(EPS, p));

/** The night's stages; a night without groups is one stage. */
export function nightStages(night: NightDifficulty): NightStage[] {
  if (night.stages?.length) return night.stages;
  return [
    {
      enemyCount: night.enemyCount,
      totalHp: night.totalHp,
      totalDamage: night.totalDamage,
      totalWallDamage: night.totalWallDamage,
      startSec: 0,
      spanSec: night.spawnSpanSec,
    },
  ];
}

/** One stage as a night, for `nightPressure` (no nested stages). */
export function stageDifficulty(
  night: NightDifficulty,
  stage: NightStage,
): NightDifficulty {
  return {
    night: night.night,
    rewardGold: 0,
    enemyCount: stage.enemyCount,
    totalHp: stage.totalHp,
    totalDamage: stage.totalDamage,
    totalWallDamage: stage.totalWallDamage,
    spawnSpanSec: stage.spanSec,
  };
}

/**
 * Resolve a night stage by stage. `pressure` is the whole-night pressure the
 * caller already computed (its `winChance` is the night's chance); `rng` is the
 * night's win stream.
 */
export function resolveNightStages(
  power: PlayerPower,
  night: NightDifficulty,
  wallHpMax: number,
  model: PowerModel,
  boost: ConsumableBoost,
  rng: Rng,
  pressure: NightPressure,
): NightOutcome {
  const stages = nightStages(night);
  const pNight = clampP(pressure.winChance);
  const totalHp = stages.reduce((a, s) => a + Math.max(0, s.totalHp), 0);
  // Consumables are spread over the night (bombs land where the crowd is).
  const stageBoost: ConsumableBoost = {
    healHp: boost.healHp / stages.length,
    bombDamage: boost.bombDamage / stages.length,
  };

  // Deterministic pass: each stage's margin while the player spends the night's
  // HP and wall budget, so later groups are judged with what is left.
  const margin: Array<{
    pressure: NightPressure;
    risk: number;
    hpAfter: number;
    wallAfter: number;
  }> = [];
  let hp = 1;
  let wall = 1;
  for (const stage of stages) {
    const p = nightPressure(
      power,
      stageDifficulty(night, stage),
      wallHpMax * Math.max(EPS, wall),
      model,
      stageBoost,
    );
    const score =
      p.offenceRatio ** model.offenceWeight *
      (p.defenceRatio * Math.max(EPS, hp)) ** model.defenceWeight *
      (p.wallRatio * Math.max(EPS, wall)) ** model.wallWeight;
    const raw = winChance(score, model.steepness);
    const hpShare =
      totalHp > 0 ? Math.max(0, stage.totalHp) / totalHp : 1 / stages.length;
    hp = Math.max(0, hp - 1 / Math.max(EPS, p.defenceRatio));
    wall = Math.max(0, wall - 1 / Math.max(EPS, p.wallRatio));
    margin.push({
      pressure: p,
      risk: Math.max(EPS, 1 - raw) * hpShare,
      hpAfter: hp,
      wallAfter: wall,
    });
  }
  const riskSum = margin.reduce((a, m) => a + m.risk, 0);

  // Stochastic pass: the night's failure probability, split by risk.
  const out: StageOutcome[] = [];
  let hpLeft = 1;
  let wallLeft = 1;
  let failedStage: number | null = null;
  let failedOn: NightOutcome["failedOn"] = null;
  for (const [i, m] of margin.entries()) {
    const chance = pNight ** (m.risk / riskSum);
    const won = rng() < chance;
    const defaults = { hpLeft: m.hpAfter, wallLeft: m.wallAfter };
    out.push({
      index: i,
      hpShare:
        totalHp > 0
          ? Math.max(0, stages[i]!.totalHp) / totalHp
          : 1 / stages.length,
      chance,
      won,
      offenceRatio: m.pressure.offenceRatio,
      defenceRatio: m.pressure.defenceRatio,
      wallRatio: m.pressure.wallRatio,
      ...defaults,
    });
    if (!won) {
      failedStage = i;
      const offence = m.pressure.offenceRatio;
      const defence = m.pressure.defenceRatio * Math.max(EPS, hpLeft);
      const wallRatio = m.pressure.wallRatio * Math.max(EPS, wallLeft);
      failedOn =
        offence <= defence && offence <= wallRatio
          ? "offence"
          : defence <= wallRatio
            ? "defence"
            : "wall";
    }
    hpLeft = m.hpAfter;
    wallLeft = m.wallAfter;
    if (!won) break;
  }
  return {
    won: failedStage === null,
    stages: out,
    failedStage,
    failedOn,
    hpLeft,
    wallLeft,
  };
}
