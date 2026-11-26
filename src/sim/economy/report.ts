import { RARITY_IDS } from "../../gear/gearTypes";
import {
  NIGHT_METRICS,
  rarityShares,
  type FlagThresholds,
  type NightMetric,
  type PriceRow,
  type StrategySummary,
} from "./aggregate";
import type { RunResult } from "./simulate";
import { STRATEGY_LABELS, type StrategyId } from "./simulate";
import { ITEM_SYSTEM_HTML } from "./itemSystem";

export type ReportMeta = {
  seed: number;
  runs: number;
  winModel: string;
  winRate: number;
  overrides: string[];
  flags: FlagThresholds;
  generatedAt: string;
};

const fmt = (v: number, digits = 0) =>
  Number.isFinite(v) ? v.toFixed(digits) : "∞";

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i]!.length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padStart(widths[i]!)).join("  ");
  return [
    line(headers),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
  ].join("\n");
}

/** Plain-text summary for the terminal. */
export function consoleSummary(
  summaries: readonly StrategySummary[],
  prices: readonly PriceRow[],
  meta: ReportMeta,
): string {
  const out: string[] = [];
  out.push(
    `Economy sim: ${meta.runs} runs/strategy, seed ${meta.seed}, win model ${meta.winModel}${meta.winModel === "fixed" ? ` (${meta.winRate})` : ""}`,
  );
  if (meta.overrides.length)
    out.push(`Overrides: ${meta.overrides.join(", ")}`);
  out.push("");
  out.push("Strategies (median, p10–p90 in brackets)");
  out.push(
    table(
      [
        "strategy",
        "finish%",
        "nights",
        "losses",
        "earned",
        "sales",
        "wall",
        "gear",
        "potions",
        "banked",
        "ilvl",
        "power",
        "drops%",
        "trader%",
        "smith%",
      ],
      summaries.map((s) => [
        s.strategy,
        fmt(s.finishedPct),
        `${fmt(s.nightsPlayed.p50)} (${fmt(s.nightsPlayed.p10)}–${fmt(s.nightsPlayed.p90)})`,
        `${fmt(s.losses.p50)} (${fmt(s.losses.p10)}–${fmt(s.losses.p90)})`,
        fmt(s.totalEarned.p50),
        fmt(s.totalSales.p50),
        fmt(s.totalSpentWall.p50),
        fmt(s.totalSpentGear.p50),
        fmt(s.totalSpentConsumables.p50),
        fmt(s.finalGold.p50),
        fmt(s.finalAvgItemLevel.p50, 1),
        fmt(s.finalPowerRatio.p50, 2),
        fmt(s.finalFromDropsPct),
        fmt(s.finalFromTraderPct),
        fmt(s.finalFromBlacksmithPct),
      ]),
    ),
  );
  for (const s of summaries) {
    out.push("");
    out.push(`${s.strategy}: ${STRATEGY_LABELS[s.strategy]}`);
    out.push(
      table(
        [
          "night",
          "reward",
          "enemyHP",
          "reached%",
          "losses",
          "banked",
          "spent",
          "wallLv",
          "ilvl",
          "dps",
          "ehp",
          "power p10/50/90",
          "win%",
          "afford%",
          "flag",
        ],
        s.nights.map((n) => {
          const m = n.metrics;
          return [
            String(n.night),
            fmt(n.rewardGold),
            fmt(n.enemyHp),
            fmt(n.reachedPct),
            fmt(n.lossesPerRun, 2),
            fmt(m.goldBanked.p50),
            fmt(m.spentWall.p50 + m.spentGear.p50 + m.spentConsumables.p50),
            fmt(m.wallLevel.p50),
            fmt(m.avgItemLevel.p50, 1),
            fmt(m.offenceDps.p50),
            fmt(m.ehp.p50),
            `${fmt(m.powerRatio.p10, 2)}/${fmt(m.powerRatio.p50, 2)}/${fmt(m.powerRatio.p90, 2)}`,
            fmt(100 * m.winChance.p50),
            fmt(m.shopAffordablePct.p50),
            n.flag,
          ];
        }),
      ),
    );
  }
  out.push("");
  out.push("Blacksmith prices vs the unlock night's reward");
  out.push(
    table(
      ["item", "night", "price", "reward", "nights of pay"],
      prices.map((p) => [
        p.name,
        String(p.unlockNight),
        fmt(p.price),
        fmt(p.nightReward),
        fmt(p.nightsOfPay, 1),
      ]),
    ),
  );
  out.push("");
  out.push(
    `Flags: "too easy" = median power ratio ≥ ${meta.flags.easy}; "too hard" = below ${meta.flags.hard} (≤50% win chance).`,
  );
  return out.join("\n");
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvLine = (cells: (string | number)[]) => cells.map(csvCell).join(",");

/** One row per strategy × night with p10 / p50 / p90 of every metric. */
export function nightsCsv(summaries: readonly StrategySummary[]): string {
  const metrics = Object.keys(NIGHT_METRICS) as NightMetric[];
  const header = [
    "strategy",
    "night",
    "reachedPct",
    "lossesPerRun",
    "autoSoldPerRun",
    "consumablesPerRun",
    "flag",
    ...RARITY_IDS.map((r) => `equipped_${r}`),
    ...metrics.flatMap((m) => [`${m}_p10`, `${m}_p50`, `${m}_p90`]),
  ];
  const rows = summaries.flatMap((s) =>
    s.nights.map((n) =>
      csvLine([
        s.strategy,
        n.night,
        n.reachedPct.toFixed(1),
        n.lossesPerRun.toFixed(3),
        n.autoSoldPerRun.toFixed(3),
        n.consumablesPerRun.toFixed(3),
        n.flag,
        ...RARITY_IDS.map((r) => n.equippedRarity[r].toFixed(2)),
        ...metrics.flatMap((m) => [
          +n.metrics[m].p10.toFixed(3),
          +n.metrics[m].p50.toFixed(3),
          +n.metrics[m].p90.toFixed(3),
        ]),
      ]),
    ),
  );
  return `${[csvLine(header), ...rows].join("\n")}\n`;
}

/** One row per simulated run. */
export function runsCsv(
  runsByStrategy: ReadonlyMap<StrategyId, readonly RunResult[]>,
): string {
  const header = [
    "strategy",
    "seed",
    "finished",
    "nightsPlayed",
    "losses",
    "goldEarned",
    "salesGold",
    "spentWall",
    "spentGear",
    "spentConsumables",
    "finalGold",
    "finalWallLevel",
    "finalAvgItemLevel",
    "finalPowerRatio",
    "autoSold",
  ];
  const rows: string[] = [];
  for (const [strategy, runs] of runsByStrategy) {
    for (const run of runs) {
      const recs = run.records;
      const last = recs[recs.length - 1];
      const total = (f: (r: (typeof recs)[number]) => number) =>
        recs.reduce((a, r) => a + f(r), 0);
      rows.push(
        csvLine([
          strategy,
          run.seed,
          run.finished ? 1 : 0,
          recs.length,
          recs.filter((r) => !r.won).length,
          total((r) => r.goldEarned),
          total((r) => r.salesGold),
          total((r) => r.spentWall),
          total((r) => r.spentGear),
          total((r) => r.spentConsumables),
          last?.goldBanked ?? 0,
          last?.wallLevel ?? 0,
          +(last?.avgItemLevel ?? 0).toFixed(2),
          +(last?.pressure.powerRatio ?? 0).toFixed(3),
          total((r) => r.autoSold),
        ]),
      );
    }
  }
  return `${[csvLine(header), ...rows].join("\n")}\n`;
}

// ---------- HTML ----------

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
];
const RARITY_COLORS: Record<string, string> = {
  common: "#a1a1aa",
  magic: "#3b82f6",
  rare: "#eab308",
  epic: "#a855f7",
  legendary: "#f97316",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Series = { name: string; color: string; points: [number, number][] };

/** Minimal inline SVG line chart (no external libraries). */
export function lineChart(
  title: string,
  yLabel: string,
  series: readonly Series[],
  refLines: readonly { y: number; label: string; color: string }[] = [],
): string {
  const W = 640;
  const H = 300;
  const L = 56;
  const R = 150;
  const T = 30;
  const B = 40;
  const xs = series.flatMap((s) => s.points.map((p) => p[0]));
  const ys = [
    ...series.flatMap((s) => s.points.map((p) => p[1])),
    ...refLines.map((r) => r.y),
    0,
  ];
  const xMin = Math.min(...xs, 1);
  const xMax = Math.max(...xs, xMin + 1);
  const yMax = Math.max(...ys, 1) * 1.08;
  const sx = (x: number) => L + ((x - xMin) / (xMax - xMin)) * (W - L - R);
  const sy = (y: number) => H - B - (y / yMax) * (H - T - B);
  const parts: string[] = [];
  parts.push(
    `<text x="${L}" y="18" font-weight="600">${esc(title)}</text>`,
    `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#999"/>`,
    `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#999"/>`,
    `<text x="${L - 6}" y="${T - 12}" text-anchor="end" font-size="11" fill="#555">${esc(yLabel)}</text>`,
  );
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    parts.push(
      `<text x="${L - 6}" y="${sy(v) + 4}" font-size="10" text-anchor="end" fill="#555">${fmt(v, v < 10 ? 1 : 0)}</text>`,
      `<line x1="${L}" y1="${sy(v)}" x2="${W - R}" y2="${sy(v)}" stroke="#eee"/>`,
    );
  }
  for (let x = Math.ceil(xMin); x <= xMax; x++) {
    parts.push(
      `<text x="${sx(x)}" y="${H - B + 14}" font-size="10" text-anchor="middle" fill="#555">${x}</text>`,
    );
  }
  parts.push(
    `<text x="${(L + W - R) / 2}" y="${H - 6}" font-size="11" text-anchor="middle" fill="#555">night</text>`,
  );
  for (const r of refLines) {
    parts.push(
      `<line x1="${L}" y1="${sy(r.y)}" x2="${W - R}" y2="${sy(r.y)}" stroke="${r.color}" stroke-dasharray="5 4"/>`,
      `<text x="${W - R + 4}" y="${sy(r.y) + 4}" font-size="10" fill="${r.color}">${esc(r.label)}</text>`,
    );
  }
  series.forEach((s, i) => {
    const d = s.points
      .map(
        (p, j) =>
          `${j ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`,
      )
      .join(" ");
    parts.push(
      `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"/>`,
      `<rect x="${W - R + 8}" y="${T + i * 16}" width="10" height="10" fill="${s.color}"/>`,
      `<text x="${W - R + 22}" y="${T + i * 16 + 9}" font-size="11">${esc(s.name)}</text>`,
    );
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, sans-serif">${parts.join("")}</svg>`;
}

/** Horizontal 100% stacked bars, one per row. */
export function stackedBars(
  title: string,
  rows: readonly { label: string; shares: Record<string, number> }[],
  colors: Record<string, string>,
): string {
  const W = 640;
  const rowH = 26;
  const L = 130;
  const H = 40 + rows.length * rowH + 24;
  const keys = Object.keys(colors);
  const parts: string[] = [
    `<text x="0" y="18" font-weight="600">${esc(title)}</text>`,
  ];
  rows.forEach((row, i) => {
    const y = 30 + i * rowH;
    parts.push(
      `<text x="${L - 6}" y="${y + 15}" font-size="11" text-anchor="end">${esc(row.label)}</text>`,
    );
    let x = L;
    for (const k of keys) {
      const share = row.shares[k] ?? 0;
      const w = (share / 100) * (W - L - 10);
      if (w <= 0) continue;
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${rowH - 6}" fill="${colors[k]}"><title>${esc(k)} ${fmt(share, 1)}%</title></rect>`,
      );
      if (w > 30) {
        parts.push(
          `<text x="${(x + w / 2).toFixed(1)}" y="${y + 14}" font-size="10" text-anchor="middle" fill="#fff">${fmt(share)}%</text>`,
        );
      }
      x += w;
    }
  });
  keys.forEach((k, i) => {
    const x = L + i * 95;
    const y = H - 14;
    parts.push(
      `<rect x="${x}" y="${y - 9}" width="10" height="10" fill="${colors[k]}"/>`,
      `<text x="${x + 14}" y="${y}" font-size="11">${esc(k)}</text>`,
    );
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, sans-serif">${parts.join("")}</svg>`;
}

function htmlTable(headers: string[], rows: string[][]): string {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td class="${c === "too easy" ? "easy" : c === "too hard" ? "hard" : ""}">${esc(c)}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
}

/** Self-contained HTML report (inline CSS + SVG, no network). */
export function htmlReport(
  summaries: readonly StrategySummary[],
  prices: readonly PriceRow[],
  meta: ReportMeta,
): string {
  const series = (
    pick: (
      s: StrategySummary,
    ) => (n: StrategySummary["nights"][number]) => number,
  ) =>
    summaries.map((s, i) => ({
      name: s.strategy,
      color: COLORS[i % COLORS.length]!,
      points: s.nights
        .filter((n) => n.reachedPct > 0)
        .map((n) => [n.night, pick(s)(n)] as [number, number]),
    }));
  const first = summaries[0];
  const difficulty: Series[] = first
    ? [
        {
          name: "enemy HP ÷ 100",
          color: "#dc2626",
          points: first.nights.map((n) => [n.night, n.enemyHp / 100]),
        },
        {
          name: "reward gold ÷ 10",
          color: "#ca8a04",
          points: first.nights.map((n) => [n.night, n.rewardGold / 10]),
        },
      ]
    : [];
  const charts = [
    lineChart(
      "Gold banked after the town phase (median)",
      "gold",
      series(() => (n) => n.metrics.goldBanked.p50),
    ),
    lineChart(
      "Power vs wave difficulty (median power ratio)",
      "ratio",
      series(() => (n) => n.metrics.powerRatio.p50),
      [
        {
          y: meta.flags.easy,
          label: `too easy ≥ ${meta.flags.easy}`,
          color: "#16a34a",
        },
        {
          y: meta.flags.hard,
          label: `too hard < ${meta.flags.hard}`,
          color: "#dc2626",
        },
      ],
    ),
    lineChart(
      "Offence DPS (median, after shopping)",
      "DPS",
      series(() => (n) => n.metrics.offenceDps.p50),
    ),
    lineChart(
      "Effective HP (median, after shopping)",
      "EHP",
      series(() => (n) => n.metrics.ehp.p50),
    ),
    lineChart(
      "Shop gear affordable on entering town (median %)",
      "%",
      series(() => (n) => n.metrics.shopAffordablePct.p50),
    ),
    lineChart(
      "Average equipped item level (median)",
      "ilvl",
      series(() => (n) => n.metrics.avgItemLevel.p50),
    ),
    lineChart("Wave size (same for every strategy)", "scaled", difficulty),
    stackedBars(
      "Rarity of all drops (share)",
      summaries.map((s) => ({
        label: s.strategy,
        shares: rarityShares(s.dropRarity),
      })),
      RARITY_COLORS,
    ),
    stackedBars(
      "Rarity of equipped gear at campaign end (share)",
      summaries.map((s) => ({
        label: s.strategy,
        shares: rarityShares(s.finalEquippedRarity),
      })),
      RARITY_COLORS,
    ),
  ];
  const summaryTable = htmlTable(
    [
      "strategy",
      "what it does",
      "finish %",
      "nights played (p50)",
      "losses (p50)",
      "earned",
      "sales",
      "wall",
      "gear",
      "potions",
      "banked at end",
      "end ilvl",
      "end power",
      "end gear from drops %",
      "from trader %",
      "from blacksmith %",
    ],
    summaries.map((s) => [
      s.strategy,
      STRATEGY_LABELS[s.strategy],
      fmt(s.finishedPct),
      fmt(s.nightsPlayed.p50),
      fmt(s.losses.p50),
      fmt(s.totalEarned.p50),
      fmt(s.totalSales.p50),
      fmt(s.totalSpentWall.p50),
      fmt(s.totalSpentGear.p50),
      fmt(s.totalSpentConsumables.p50),
      fmt(s.finalGold.p50),
      fmt(s.finalAvgItemLevel.p50, 1),
      fmt(s.finalPowerRatio.p50, 2),
      fmt(s.finalFromDropsPct),
      fmt(s.finalFromTraderPct),
      fmt(s.finalFromBlacksmithPct),
    ]),
  );
  const nightTables = summaries
    .map(
      (s) =>
        `<h3>${esc(s.strategy)} — ${esc(STRATEGY_LABELS[s.strategy])}</h3>` +
        htmlTable(
          [
            "night",
            "reward",
            "enemy HP",
            "reached %",
            "losses/run",
            "banked p50",
            "wall lv",
            "ilvl",
            "DPS",
            "EHP",
            "power p10",
            "p50",
            "p90",
            "win % p50",
            "afford %",
            "bag",
            "auto-sold/run",
            "flag",
          ],
          s.nights.map((n) => {
            const m = n.metrics;
            return [
              String(n.night),
              fmt(n.rewardGold),
              fmt(n.enemyHp),
              fmt(n.reachedPct),
              fmt(n.lossesPerRun, 2),
              fmt(m.goldBanked.p50),
              fmt(m.wallLevel.p50),
              fmt(m.avgItemLevel.p50, 1),
              fmt(m.offenceDps.p50),
              fmt(m.ehp.p50),
              fmt(m.powerRatio.p10, 2),
              fmt(m.powerRatio.p50, 2),
              fmt(m.powerRatio.p90, 2),
              fmt(100 * m.winChance.p50),
              fmt(m.shopAffordablePct.p50),
              fmt(m.bagCount.p50),
              fmt(n.autoSoldPerRun, 2),
              n.flag,
            ];
          }),
        ),
    )
    .join("");
  const priceTable = htmlTable(
    ["item", "unlock night", "price", "night reward", "nights of pay"],
    prices.map((p) => [
      p.name,
      String(p.unlockNight),
      fmt(p.price),
      fmt(p.nightReward),
      fmt(p.nightsOfPay, 1),
    ]),
  );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>DefenseGame economy sim</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#18181b;max-width:1400px}
h1{margin:0 0 4px}.meta{color:#52525b;margin-bottom:16px}
.charts{display:grid;grid-template-columns:repeat(auto-fill,minmax(660px,1fr));gap:16px}
.card{border:1px solid #e4e4e7;border-radius:8px;padding:10px;background:#fff}
table{border-collapse:collapse;font-size:12px;margin:8px 0 20px}
th,td{border:1px solid #e4e4e7;padding:3px 6px;text-align:right}
th{background:#f4f4f5}td:nth-child(2){text-align:left}
td.easy{background:#dcfce7}td.hard{background:#fee2e2}
</style></head><body>
<h1>DefenseGame economy and progression sim</h1>
<div class="meta">${meta.runs} runs per strategy · seed ${meta.seed} · win model <b>${esc(meta.winModel)}</b>${meta.winModel === "fixed" ? ` (${meta.winRate})` : ""} · generated ${esc(meta.generatedAt)}${meta.overrides.length ? ` · overrides: <code>${esc(meta.overrides.join(", "))}</code>` : ""}</div>
<h2>Strategies</h2>${summaryTable}
<div class="charts">${charts.map((c) => `<div class="card">${c}</div>`).join("")}</div>
<h2>Per night</h2><p>Each row uses the attempt that ended the night (the win, or the last loss for runs that gave up). Power ratio 1 = even fight (50% win chance); green ≥ ${meta.flags.easy} "too easy", red &lt; ${meta.flags.hard} "too hard".</p>${nightTables}
<h2>Blacksmith prices</h2>${priceTable}
${ITEM_SYSTEM_HTML}
</body></html>
`;
}
