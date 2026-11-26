import { describe, expect, it } from "vitest";
import { aggregateRuns, blacksmithPriceTable } from "./aggregate";
import {
  consoleSummary,
  htmlReport,
  lineChart,
  nightList,
  nightsCsv,
  runsCsv,
  stackedBars,
  type ReportMeta,
} from "./report";
import {
  defaultSimOptions,
  simulateMany,
  type StrategyId,
  type RunResult,
} from "./simulate";
import { defaultRawData, loadSimData } from "./simData";

const data = loadSimData(defaultRawData());
const runs = simulateMany(data, defaultSimOptions(data), 1, 5);
const summary = aggregateRuns("balanced", runs, data);
const prices = blacksmithPriceTable(data);
const meta: ReportMeta = {
  seed: 1,
  runs: 5,
  winModel: "power",
  winRate: 0.85,
  overrides: [],
  flags: { easy: 2, hard: 1 },
  generatedAt: "2026-11-26T00:00:00.000Z",
};

describe("report", () => {
  it("prints strategy and per-night tables", () => {
    const text = consoleSummary([summary], prices, meta);
    expect(text).toMatch(
      /Economy sim: 5 runs\/strategy, seed 1, win model power/,
    );
    expect(text).toMatch(/balanced: Best upgrade per gold/);
    expect(text).toMatch(/too easy/);
    expect(text).toMatch(/Blacksmith prices/);
    const fixed = consoleSummary([summary], prices, {
      ...meta,
      winModel: "fixed",
      overrides: ["loot.sellBackPct=25"],
    });
    expect(fixed).toMatch(/win model fixed \(0.85\)/);
    expect(fixed).toMatch(/Overrides: loot.sellBackPct=25/);
    const inf = consoleSummary(
      [summary],
      [
        {
          ...prices[0]!,
          nightReward: 0,
          nightsOfPay: Number.POSITIVE_INFINITY,
        },
      ],
      meta,
    );
    expect(inf).toMatch(/∞/);
  });

  it("writes per-night and per-run CSV", () => {
    const nights = nightsCsv([summary]).trim().split("\n");
    expect(nights[0]).toMatch(/^strategy,night,reachedPct/);
    expect(nights[0]).toMatch(/powerRatio_p50/);
    expect(nights).toHaveLength(1 + data.nights.length);
    const byStrategy = new Map<StrategyId, RunResult[]>([
      ["balanced", runs],
      ["no-spend", [{ seed: 9, finished: false, records: [] }]],
    ]);
    const lines = runsCsv(byStrategy).trim().split("\n");
    expect(lines[0]).toMatch(/^strategy,seed,finished/);
    expect(lines).toHaveLength(1 + runs.length + 1);
    expect(lines.at(-1)).toBe("no-spend,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0");
  });

  it("quotes CSV cells that need it", () => {
    const s = {
      ...summary,
      nights: [{ ...summary.nights[0]!, flag: 'a,"b"' as never }],
    };
    expect(nightsCsv([s])).toMatch(/"a,""b"""/);
  });

  it("builds a self-contained HTML report with SVG charts", () => {
    const html = htmlReport([summary], prices, {
      ...meta,
      winModel: "fixed",
      overrides: ["x=<1>"],
    });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).not.toMatch(/<script|https?:\/\/(?!www\.w3\.org)/);
    expect(html).toContain("How rarity and item level work");
    expect(html).toContain("from blacksmith %");
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(html).toMatch(/x=&lt;1&gt;/);
    expect(html).toMatch(/class="easy"/);
    expect(htmlReport([], prices, meta)).toMatch(/<h2>Strategies<\/h2>/);
  });

  it("draws charts with reference lines and empty series", () => {
    const svg = lineChart(
      "T",
      "y",
      [
        {
          name: "a",
          color: "#000",
          points: [
            [1, 5],
            [2, 20],
          ],
        },
      ],
      [{ y: 1, label: "ref", color: "#f00" }],
    );
    expect(svg).toMatch(/stroke-dasharray/);
    expect(svg).toMatch(/<path d="M/);
    expect(lineChart("E", "y", [])).toMatch(/<svg/);
    const bars = stackedBars("B", [{ label: "r", shares: { a: 80 } }], {
      a: "#000",
      b: "#fff",
    });
    expect(bars).toMatch(/80%/);
    expect(
      stackedBars("B", [{ label: "r", shares: { a: 5 } }], { a: "#000" }),
    ).not.toMatch(/>5%<\/text>/);
  });

  it("compacts night lists into ranges", () => {
    expect(nightList([])).toBe("—");
    expect(nightList([1, 2, 3, 8])).toBe("1–3, 8");
    expect(nightList([5])).toBe("5");
    expect(nightList([2, 4, 5])).toBe("2, 4–5");
  });
});
