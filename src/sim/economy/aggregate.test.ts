import { describe, expect, it } from "vitest";
import {
  aggregateRuns,
  blacksmithPriceTable,
  percentile,
  percentiles,
  rarityShares,
} from "./aggregate";
import { defaultSimOptions, emptyRarityCounts, simulateMany } from "./simulate";
import { defaultRawData, loadSimData } from "./simData";

const data = loadSimData(defaultRawData());

describe("aggregate", () => {
  it("computes nearest-rank percentiles", () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([5, 1, 3], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.1)).toBe(1);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(percentiles([2])).toEqual({ p10: 2, p50: 2, p90: 2 });
  });

  it("summarises runs per night and flags easy / hard nights", () => {
    const runs = simulateMany(data, defaultSimOptions(data), 1, 20);
    const s = aggregateRuns("balanced", runs, data, { easy: 2, hard: 1 });
    expect(s.runs).toBe(20);
    expect(s.nights).toHaveLength(data.nights.length);
    expect(s.nights[0]!.reachedPct).toBe(100);
    expect(s.nights[0]!.flag).toBe("too easy");
    expect(s.nights[0]!.metrics.goldEarned.p50).toBe(
      data.nights[0]!.rewardGold,
    );
    expect(s.totalEarned.p50).toBeGreaterThan(0);
    expect(s.finalFromDropsPct).toBeGreaterThan(0);
    const dropTotal = Object.values(s.dropRarity).reduce((a, b) => a + b, 0);
    expect(dropTotal).toBeGreaterThan(0);
    const hard = aggregateRuns("balanced", runs, data, { easy: 99, hard: 99 });
    expect(hard.nights.every((n) => n.flag === "too hard")).toBe(true);
    const none = aggregateRuns("balanced", runs, data, { easy: 99, hard: 0 });
    expect(none.nights.every((n) => n.flag === "")).toBe(true);
  });

  it("handles an empty run list and unreached nights", () => {
    const s = aggregateRuns("no-spend", [], data);
    expect(s.finishedPct).toBe(0);
    expect(s.finalFromDropsPct).toBe(0);
    expect(s.nights[0]!.reachedPct).toBe(0);
    expect(s.nights[0]!.flag).toBe("");
    const short = aggregateRuns(
      "no-spend",
      [{ seed: 1, finished: false, records: [] }],
      data,
    );
    expect(short.finalGold.p50).toBe(0);
    expect(short.finalAvgItemLevel.p50).toBe(0);
    expect(short.finalPowerRatio.p50).toBe(0);
  });

  it("prices the blacksmith catalogue against the unlock night's reward", () => {
    const rows = blacksmithPriceTable(data);
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.unlockNight).toBeGreaterThanOrEqual(
        rows[i - 1]!.unlockNight,
      );
    }
    const r = rows[0]!;
    expect(r.nightsOfPay).toBeCloseTo(r.price / r.nightReward);
    const odd = blacksmithPriceTable({
      ...data,
      shops: {
        ...data.shops,
        blacksmith: {
          ...data.shops.blacksmith,
          items: [
            { baseId: "ghost", unlockNight: 1 },
            { baseId: "rusty_sword", unlockNight: 99 },
          ],
        },
      },
    });
    expect(odd).toHaveLength(1);
    expect(odd[0]!.nightsOfPay).toBe(Number.POSITIVE_INFINITY);
  });

  it("reports 0% affordable when a shop is empty", () => {
    const run = simulateMany(data, defaultSimOptions(data), 1, 1)[0]!;
    const records = run.records.map((r) => ({
      ...r,
      shopItems: 0,
      shopAffordable: 0,
    }));
    const s = aggregateRuns("balanced", [{ ...run, records }], data);
    expect(s.nights[0]!.metrics.shopAffordablePct.p50).toBe(0);
  });

  it("converts rarity counts to shares", () => {
    expect(rarityShares(emptyRarityCounts()).common).toBe(0);
    const c = { ...emptyRarityCounts(), common: 3, rare: 1 };
    expect(rarityShares(c)).toMatchObject({ common: 75, rare: 25 });
  });
});
