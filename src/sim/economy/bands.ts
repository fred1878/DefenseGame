import type { StrategyId } from "./simulate";

/**
 * Fixed-seed regression bands for the economy sim.
 *
 * A seeded sim is deterministic, so a change in a headline number means
 * balance or sim code changed, not luck. The band file records what a known
 * seed produced; `--bands FILE` re-runs it and reports every metric outside
 * its tolerance. It is advisory: report the drift, do not fail a release on
 * it until the bands have proven stable (see docs/ECONOMY_SIM.md).
 */
export type BandMetric = {
  /** Allowed absolute drift (points, gold, nights, …). */
  abs: number;
  /** Allowed relative drift as a fraction of the expected value. */
  rel: number;
};

export type BandEntry = Record<string, number>;

export type BandsMeta = {
  seed: number;
  runs: number;
  winModel: string;
  winRate: number;
  nights: number;
};

export type BandsFile = {
  meta: BandsMeta;
  /** strategy id → metric name → value. */
  strategies: Record<string, BandEntry>;
};

/** Per-metric tolerances; anything unset uses the default. */
export const BAND_METRICS: Record<string, BandMetric> = {
  finishedPct: { abs: 4, rel: 0.15 },
  nightsPlayedP50: { abs: 0.6, rel: 0.05 },
  lossesP50: { abs: 0.6, rel: 0.25 },
  totalEarnedP50: { abs: 40, rel: 0.1 },
  totalSalesP50: { abs: 40, rel: 0.2 },
  totalSpentGearP50: { abs: 40, rel: 0.2 },
  totalSpentWallP50: { abs: 30, rel: 0.2 },
  finalGoldP50: { abs: 40, rel: 0.25 },
  finalAvgItemLevelP50: { abs: 1, rel: 0.1 },
  finalPowerRatioP50: { abs: 0.35, rel: 0.15 },
  deficitPct: { abs: 4, rel: 0.15 },
  purchasingPowerP50: { abs: 0.25, rel: 0.2 },
  lateLossPct: { abs: 6, rel: 0.2 },
};

const DEFAULT_BAND: BandMetric = { abs: 1, rel: 0.2 };

export type BandsSummary = {
  strategy: string;
  finishedPct: number;
  nightsPlayed: { p50: number };
  losses: { p50: number };
  totalEarned: { p50: number };
  totalSales: { p50: number };
  totalSpentGear: { p50: number };
  totalSpentWall: { p50: number };
  finalGold: { p50: number };
  finalAvgItemLevel: { p50: number };
  finalPowerRatio: { p50: number };
  deficitPct: number;
  purchasingPower: { p50: number };
  lateLossPct: number;
};

/** Flatten strategy summaries to the handful of numbers a band file keeps. */
export function bandsFrom(
  summaries: readonly BandsSummary[],
  meta: BandsMeta,
): BandsFile {
  return {
    meta,
    strategies: Object.fromEntries(
      summaries.map((s) => [
        s.strategy as StrategyId,
        {
          finishedPct: s.finishedPct,
          nightsPlayedP50: s.nightsPlayed.p50,
          lossesP50: s.losses.p50,
          totalEarnedP50: s.totalEarned.p50,
          totalSalesP50: s.totalSales.p50,
          totalSpentGearP50: s.totalSpentGear.p50,
          totalSpentWallP50: s.totalSpentWall.p50,
          finalGoldP50: s.finalGold.p50,
          finalAvgItemLevelP50: s.finalAvgItemLevel.p50,
          finalPowerRatioP50: s.finalPowerRatio.p50,
          deficitPct: s.deficitPct,
          purchasingPowerP50: s.purchasingPower.p50,
          lateLossPct: s.lateLossPct,
        },
      ]),
    ),
  };
}

const round = (v: number, digits = 3) => {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
};

/** Human-readable drifts between a run and its bands (empty = within bands). */
export function bandDrift(
  actual: BandsFile,
  expected: BandsFile,
  metrics: Record<string, BandMetric> = BAND_METRICS,
): string[] {
  const out: string[] = [];
  const metaKeys = ["seed", "runs", "winModel", "winRate", "nights"] as const;
  for (const k of metaKeys) {
    if (actual.meta[k] !== expected.meta[k]) {
      out.push(`meta.${k}: ${actual.meta[k]} (bands ${expected.meta[k]})`);
    }
  }
  for (const [strategy, want] of Object.entries(expected.strategies)) {
    const got = actual.strategies[strategy];
    if (!got) {
      out.push(`${strategy}: missing from this run`);
      continue;
    }
    for (const [metric, expectedValue] of Object.entries(want)) {
      const value = got[metric];
      if (value === undefined) {
        out.push(`${strategy}.${metric}: missing`);
        continue;
      }
      const band = metrics[metric] ?? DEFAULT_BAND;
      const allowed = Math.max(band.abs, Math.abs(expectedValue) * band.rel);
      if (Math.abs(value - expectedValue) > allowed) {
        out.push(
          `${strategy}.${metric}: ${round(value, 2)} (bands ${round(expectedValue, 2)} ±${round(allowed, 2)})`,
        );
      }
    }
  }
  for (const strategy of Object.keys(actual.strategies)) {
    if (!expected.strategies[strategy]) {
      out.push(`${strategy}: new strategy, not in the band file`);
    }
  }
  return out;
}
