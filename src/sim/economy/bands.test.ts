import { describe, expect, it } from "vitest";
import { bandDrift, bandsFrom, type BandsFile } from "./bands";

const summary = (strategy: string, over: Record<string, number> = {}) => ({
  strategy,
  finishedPct: over.finishedPct ?? 50,
  nightsPlayed: { p50: over.nightsPlayedP50 ?? 20 },
  losses: { p50: over.lossesP50 ?? 4 },
  totalEarned: { p50: over.totalEarnedP50 ?? 1000 },
  totalSales: { p50: over.totalSalesP50 ?? 200 },
  totalSpentGear: { p50: over.totalSpentGearP50 ?? 400 },
  totalSpentWall: { p50: over.totalSpentWallP50 ?? 100 },
  finalGold: { p50: over.finalGoldP50 ?? 50 },
  finalAvgItemLevel: { p50: over.finalAvgItemLevelP50 ?? 10 },
  finalPowerRatio: { p50: over.finalPowerRatioP50 ?? 1.2 },
  deficitPct: over.deficitPct ?? 30,
  purchasingPower: { p50: over.purchasingPowerP50 ?? 1.5 },
  lateLossPct: over.lateLossPct ?? 40,
});

const meta = {
  seed: 1,
  runs: 10,
  winModel: "power",
  winRate: 0.85,
  nights: 20,
};

describe("fixed-seed bands", () => {
  it("round-trips its own run without drift", () => {
    const bands = bandsFrom([summary("balanced")], meta);
    expect(bandDrift(bands, bands)).toEqual([]);
    expect(bands.strategies.balanced!.finalPowerRatioP50).toBe(1.2);
  });

  it("reports metrics outside their band, and meta changes", () => {
    const base = bandsFrom([summary("balanced")], meta);
    const moved = bandsFrom(
      [summary("balanced", { finishedPct: 80, deficitPct: 60 })],
      { ...meta, seed: 2 },
    );
    const drift = bandDrift(moved, base);
    expect(drift.some((d) => d.includes("meta.seed"))).toBe(true);
    expect(drift.some((d) => d.includes("finishedPct"))).toBe(true);
    expect(drift.some((d) => d.includes("deficitPct"))).toBe(true);
    expect(drift.some((d) => d.includes("finalPowerRatioP50"))).toBe(false);
  });

  it("reports missing and new strategies", () => {
    const base = bandsFrom([summary("balanced"), summary("tank")], meta);
    const actual: BandsFile = {
      ...base,
      strategies: {
        balanced: base.strategies.balanced!,
        saver: { finishedPct: 1 },
      },
    };
    const drift = bandDrift(actual, base);
    expect(drift).toContain("saver: new strategy, not in the band file");
    expect(drift.some((d) => d.startsWith("tank: missing"))).toBe(true);
    const partial: BandsFile = {
      ...base,
      strategies: { balanced: { finishedPct: 50 } },
    };
    expect(
      bandDrift(partial, base).some((d) =>
        d.includes("balanced.finalPowerRatioP50: missing"),
      ),
    ).toBe(true);
  });
});
