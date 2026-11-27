import type { SaveGame } from "../../core/save/saveTypes";
import { talentBonus } from "../../talents/talentLogic";
import {
  DEFAULT_POWER_MODEL,
  nightPressure,
  playerPower,
  type ConsumableBoost,
  type NightPressure,
  type PlayerPower,
  type PowerModel,
} from "./power";
import type { NightDifficulty, SimData } from "./simData";

/**
 * Real-fight harness helpers (`npm run sim:fights`): the power model's view
 * of a saved night start, and predicted-vs-real summaries of replayed fights.
 */

/** Potions and bombs the save carries (the fight bot uses them all). */
export function carriedBoost(data: SimData, save: SaveGame): ConsumableBoost {
  const boost: ConsumableBoost = { healHp: 0, bombDamage: 0 };
  for (const [id, count] of Object.entries(save.consumables)) {
    const def = data.consumables.items[id];
    if (!def || !(count > 0)) continue;
    if (def.kind === "heal") boost.healHp += (def.healHp ?? 0) * count;
    else boost.bombDamage += (def.bomb?.damage ?? 0) * count;
  }
  return boost;
}

/** The night a save starts (clamped to the last defined night). */
export function nightFor(data: SimData, night: number): NightDifficulty {
  const idx = Math.min(Math.max(1, night), data.nights.length) - 1;
  return data.nights[idx]!;
}

/** Model pressure for the night `save` is about to play, gear + talents + carried consumables. */
export function savePressure(
  data: SimData,
  save: SaveGame,
  model: PowerModel,
): NightPressure {
  const power = playerPower(
    data.catalog,
    save.gear,
    model,
    talentBonus(data.talents, save.talents),
  );
  return nightPressure(
    power,
    nightFor(data, save.night),
    save.townWallHpMax,
    model,
    carriedBoost(data, save),
  );
}

/** One replayed fight: what the model said and what happened. */
export type FightOutcome = {
  night: number;
  strategy: string;
  tier: string;
  predicted: number;
  won: boolean;
};

export type FightCell = {
  fights: number;
  wins: number;
  /** Mean predicted win chance. */
  predicted: number;
};

const EPS = 1e-3;

/** Mean log loss (lower is better) of the predicted chances. */
export function logLoss(rows: readonly FightOutcome[]): number {
  if (!rows.length) return 0;
  let sum = 0;
  for (const r of rows) {
    const p = Math.min(1 - EPS, Math.max(EPS, r.predicted));
    sum -= r.won ? Math.log(p) : Math.log(1 - p);
  }
  return sum / rows.length;
}

/** Mean squared error of the predicted chances (Brier score). */
export function brierScore(rows: readonly FightOutcome[]): number {
  if (!rows.length) return 0;
  let sum = 0;
  for (const r of rows) sum += (r.predicted - (r.won ? 1 : 0)) ** 2;
  return sum / rows.length;
}

function cell(rows: readonly FightOutcome[]): FightCell {
  const wins = rows.filter((r) => r.won).length;
  const predicted = rows.reduce((a, r) => a + r.predicted, 0) / rows.length;
  return { fights: rows.length, wins, predicted };
}

function groupBy<K extends string | number>(
  rows: readonly FightOutcome[],
  key: (r: FightOutcome) => K,
): Map<K, FightOutcome[]> {
  const out = new Map<K, FightOutcome[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k) ?? [];
    list.push(r);
    out.set(k, list);
  }
  return out;
}

export type FightSummary = {
  fights: number;
  logLoss: number;
  brier: number;
  overall: FightCell;
  byNight: Array<{ night: number } & FightCell>;
  byStrategy: Array<{ strategy: string } & FightCell>;
  /** Night × strategy cells, nights ascending. */
  byNightStrategy: Array<{ night: number; strategy: string } & FightCell>;
};

/** Predicted vs real win rates overall, per night, per strategy and per both. */
export function summarizeFights(rows: readonly FightOutcome[]): FightSummary {
  const nights = [...groupBy(rows, (r) => r.night)].sort((a, b) => a[0] - b[0]);
  const strategies = [...groupBy(rows, (r) => r.strategy)].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  return {
    fights: rows.length,
    logLoss: logLoss(rows),
    brier: brierScore(rows),
    overall: rows.length ? cell(rows) : { fights: 0, wins: 0, predicted: 0 },
    byNight: nights.map(([night, list]) => ({ night, ...cell(list) })),
    byStrategy: strategies.map(([strategy, list]) => ({
      strategy,
      ...cell(list),
    })),
    byNightStrategy: nights.flatMap(([night, list]) =>
      [...groupBy(list, (r) => r.strategy)]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([strategy, l]) => ({ night, strategy, ...cell(l) })),
    ),
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Markdown tables for a summary (predicted / real per night and strategy). */
export function fightSummaryMarkdown(s: FightSummary): string {
  const lines = [
    `Fights: ${s.fights}. Predicted ${pct(s.overall.predicted)}, real ${s.overall.fights ? pct(s.overall.wins / s.overall.fights) : "–"}. Log loss ${s.logLoss.toFixed(3)}, Brier ${s.brier.toFixed(3)}.`,
    "",
    "| Night | Fights | Predicted | Real |",
    "|---|---|---|---|",
    ...s.byNight.map(
      (c) =>
        `| ${c.night} | ${c.fights} | ${pct(c.predicted)} | ${pct(c.wins / c.fights)} |`,
    ),
    "",
    "| Strategy | Fights | Predicted | Real |",
    "|---|---|---|---|",
    ...s.byStrategy.map(
      (c) =>
        `| ${c.strategy} | ${c.fights} | ${pct(c.predicted)} | ${pct(c.wins / c.fights)} |`,
    ),
    "",
    "| Night | Strategy | Fights | Predicted | Real |",
    "|---|---|---|---|---|",
    ...s.byNightStrategy.map(
      (c) =>
        `| ${c.night} | ${c.strategy} | ${c.fights} | ${pct(c.predicted)} | ${pct(c.wins / c.fights)} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/** Model inputs for one fight that don't depend on the model's knobs. */
export type FightSample = {
  power: PlayerPower;
  night: NightDifficulty;
  wallHpMax: number;
  boost: ConsumableBoost;
};

export function fightSample(data: SimData, save: SaveGame): FightSample {
  return {
    power: playerPower(
      data.catalog,
      save.gear,
      DEFAULT_POWER_MODEL,
      talentBonus(data.talents, save.talents),
    ),
    night: nightFor(data, save.night),
    wallHpMax: save.townWallHpMax,
    boost: carriedBoost(data, save),
  };
}

export type FitSample = FightSample & { won: boolean };

/** Mean log loss of the model's win chances on fight samples. */
export function modelLogLoss(
  samples: readonly FitSample[],
  model: PowerModel,
): number {
  return logLoss(
    samples.map((s) => ({
      night: s.night.night,
      strategy: "",
      tier: "",
      won: s.won,
      predicted: nightPressure(s.power, s.night, s.wallHpMax, model, s.boost)
        .winChance,
    })),
  );
}

type NumericKnob = Exclude<
  keyof PowerModel,
  "offenceWeight" | "defenceWeight" | "wallWeight"
>;

/** Values tried per knob by `fitPowerModel` (weights are searched as a simplex). */
export const FIT_GRID: Partial<Record<NumericKnob, number[]>> = {
  steepness: [1, 1.5, 2, 3, 4, 5, 6, 8],
  crowdAreaWu2: [5000, 10000, 20000, 40000, 80000, 160000, 320000, 640000],
  castStillShare: [0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1],
  castMovingShare: [0.1, 0.25, 0.5, 0.75, 1],
  meleeUptime: [0.3, 0.5, 0.65, 0.8, 1],
  rangedUptime: [0.15, 0.3, 0.5, 0.75, 1],
  weaponCrowd: [0, 0.25, 0.5, 1],
  exposure: [0, 0.5, 1, 1.5, 2],
  threatScale: [0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1],
  lifestealUptime: [0, 0.25, 0.5, 1],
  crowdControl: [0, 0.3, 0.6, 1],
  graceSec: [10, 20, 30, 45],
};

const WEIGHT_STEP = 0.1;

/** Offence / defence / wall weights on a 0.1 grid that sum to 1. */
export function weightSimplex(): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  const n = Math.round(1 / WEIGHT_STEP);
  for (let o = 0; o <= n; o++) {
    for (let w = 0; o + w <= n; w++) {
      out.push([o / n, (n - o - w) / n, w / n]);
    }
  }
  return out;
}

/**
 * Grid each power-ratio exponent is searched over. The three are fitted as
 * independent coefficients (no simplex, no floor on the wall), because the
 * only thing the data can identify is the log-odds contribution of each
 * ratio: `ln odds = steepness × (o·ln O + d·ln D + w·ln W)`. A coefficient can
 * therefore legitimately fit to 0 — including the wall, which the previous
 * fit held at 0.1 by hand.
 */
export const WEIGHT_GRID = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5,
  1.6,
];

export const WEIGHT_KNOBS = [
  "offenceWeight",
  "defenceWeight",
  "wallWeight",
] as const;

type WeightKnob = (typeof WEIGHT_KNOBS)[number];

/**
 * The identifiable coefficients: each ratio's contribution to the log-odds of
 * winning. Use these to read the fit (e.g. "wall adds 0.00") rather than the
 * unnormalised exponents.
 */
export function logitCoefficients(
  model: PowerModel,
): Record<WeightKnob, number> {
  return {
    offenceWeight: model.offenceWeight * model.steepness,
    defenceWeight: model.defenceWeight * model.steepness,
    wallWeight: model.wallWeight * model.steepness,
  };
}

export type FitResult = {
  model: PowerModel;
  logLoss: number;
  startLogLoss: number;
  /** Fitted log-odds contribution of each ratio (see `logitCoefficients`). */
  coefficients: Record<WeightKnob, number>;
};

/**
 * Coordinate descent on the model's knobs (each over its `grid` values,
 * the three weights over a simplex), minimising log loss on real fights.
 */
export function fitPowerModel(
  samples: readonly FitSample[],
  start: PowerModel,
  grid: Partial<Record<NumericKnob, number[]>> = FIT_GRID,
  passes = 3,
): FitResult {
  let model = { ...start };
  const startLogLoss = modelLogLoss(samples, model);
  let best = startLogLoss;
  for (let pass = 0; pass < passes; pass++) {
    let improved = false;
    // Independent coefficient search (coordinate descent), not a simplex, so
    // an unused ratio (e.g. the wall) can fit to zero instead of inheriting
    // the weight left over by the others.
    for (const knob of WEIGHT_KNOBS) {
      for (const v of WEIGHT_GRID) {
        const m = { ...model, [knob]: v };
        const ll = modelLogLoss(samples, m);
        if (ll < best - 1e-9) {
          best = ll;
          model = m;
          improved = true;
        }
      }
    }
    for (const [knob, values] of Object.entries(grid) as Array<
      [NumericKnob, number[]]
    >) {
      for (const v of values) {
        const m = { ...model, [knob]: v };
        const ll = modelLogLoss(samples, m);
        if (ll < best - 1e-9) {
          best = ll;
          model = m;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return {
    model,
    logLoss: best,
    startLogLoss,
    coefficients: logitCoefficients(model),
  };
}
