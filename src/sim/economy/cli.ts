import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  aggregateRuns,
  blacksmithPriceTable,
  type FlagThresholds,
  type StrategySummary,
} from "./aggregate";
import { DEFAULT_POWER_MODEL, type PowerModel } from "./power";
import {
  consoleSummary,
  htmlReport,
  nightsCsv,
  runsCsv,
  type ReportMeta,
} from "./report";
import {
  applyOverridesObject,
  applySetOverride,
  defaultRawData,
  loadSimData,
} from "./simData";
import {
  defaultSimOptions,
  simulateMany,
  STRATEGY_IDS,
  type RunResult,
  type StrategyId,
  type WinModel,
} from "./simulate";

export const USAGE = `Economy / progression simulator (uses the real game code and public/data).

npm run sim:economy -- [options]

  --runs N             campaigns per strategy (default 1000)
  --seed N             first seed; run i uses seed+i (default 1)
  --strategy S         all | ${STRATEGY_IDS.join(" | ")} (default all)
  --win-model M        power (default) | fixed
  --win-rate P         win chance per night for --win-model fixed (default 0.85)
  --nights N           nights to win (default: every night in waves.json)
  --set file.path=v    data override, repeatable (e.g. loot.tables.nightWon.maxRolls=3)
  --overrides FILE     JSON overrides shaped like {"loot": {...}, "waves": {...}}
  --no-sell            keep non-upgrades in the bag (bag fills, drops auto-sell)
  --spell-dps N        base spell DPS before spell power (default ${DEFAULT_POWER_MODEL.spellBaseDps})
  --grace N            seconds after the last spawn to clear a wave (default ${DEFAULT_POWER_MODEL.graceSec})
  --threat N           share of enemy hits that land (default ${DEFAULT_POWER_MODEL.threatScale})
  --steepness N        win-chance curve steepness (default ${DEFAULT_POWER_MODEL.steepness})
  --easy N / --hard N  power-ratio flags (default 2 / 1)
  --out DIR            output folder (default sim-output)
  --quiet              skip the console tables
  --help               this text
`;

export type CliOptions = {
  runs: number;
  seed: number;
  strategies: StrategyId[];
  winModel: WinModel;
  winRate: number;
  nights: number | null;
  sets: string[];
  overridesFile: string | null;
  sellSurplus: boolean;
  model: PowerModel;
  flags: FlagThresholds;
  outDir: string;
  quiet: boolean;
  help: boolean;
};

function positive(name: string, v: string | undefined, fallback: number) {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`--${name} must be a non-negative number (got "${v}")`);
  }
  return n;
}

export function parseCliArgs(argv: readonly string[]): CliOptions {
  const { values } = parseArgs({
    args: [...argv],
    strict: true,
    options: {
      runs: { type: "string" },
      seed: { type: "string" },
      strategy: { type: "string" },
      "win-model": { type: "string" },
      "win-rate": { type: "string" },
      nights: { type: "string" },
      set: { type: "string", multiple: true },
      overrides: { type: "string" },
      "no-sell": { type: "boolean" },
      "spell-dps": { type: "string" },
      grace: { type: "string" },
      threat: { type: "string" },
      steepness: { type: "string" },
      easy: { type: "string" },
      hard: { type: "string" },
      out: { type: "string" },
      quiet: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  const strategy = values.strategy ?? "all";
  if (strategy !== "all" && !STRATEGY_IDS.includes(strategy as StrategyId)) {
    throw new Error(`Unknown --strategy "${strategy}"`);
  }
  const winModel = values["win-model"] ?? "power";
  if (winModel !== "power" && winModel !== "fixed") {
    throw new Error(`--win-model must be power or fixed (got "${winModel}")`);
  }
  const winRate = positive("win-rate", values["win-rate"], 0.85);
  if (winRate > 1) throw new Error("--win-rate must be between 0 and 1");
  return {
    runs: Math.max(1, Math.floor(positive("runs", values.runs, 1000))),
    seed: Math.floor(positive("seed", values.seed, 1)),
    strategies:
      strategy === "all" ? [...STRATEGY_IDS] : [strategy as StrategyId],
    winModel,
    winRate,
    nights: values.nights
      ? Math.floor(positive("nights", values.nights, 0))
      : null,
    sets: values.set ?? [],
    overridesFile: values.overrides ?? null,
    sellSurplus: !values["no-sell"],
    model: {
      ...DEFAULT_POWER_MODEL,
      spellBaseDps: positive(
        "spell-dps",
        values["spell-dps"],
        DEFAULT_POWER_MODEL.spellBaseDps,
      ),
      graceSec: positive("grace", values.grace, DEFAULT_POWER_MODEL.graceSec),
      threatScale: positive(
        "threat",
        values.threat,
        DEFAULT_POWER_MODEL.threatScale,
      ),
      steepness: positive(
        "steepness",
        values.steepness,
        DEFAULT_POWER_MODEL.steepness,
      ),
    },
    flags: {
      easy: positive("easy", values.easy, 2),
      hard: positive("hard", values.hard, 1),
    },
    outDir: values.out ?? "sim-output",
    quiet: !!values.quiet,
    help: !!values.help,
  };
}

export type SimOutput = {
  summaries: StrategySummary[];
  runsByStrategy: Map<StrategyId, RunResult[]>;
  meta: ReportMeta;
  console: string;
  files: Record<string, string>;
};

/** Run every requested strategy and build all report files (no disk I/O). */
export function runSimulation(opts: CliOptions, now = new Date()): SimOutput {
  const raw = defaultRawData();
  if (opts.overridesFile) {
    applyOverridesObject(
      raw,
      JSON.parse(readFileSync(opts.overridesFile, "utf8")),
    );
  }
  for (const expr of opts.sets) applySetOverride(raw, expr);
  const data = loadSimData(raw);
  const base = defaultSimOptions(data);
  const nights = Math.min(
    opts.nights ?? data.nights.length,
    data.nights.length,
  );
  const runsByStrategy = new Map<StrategyId, RunResult[]>();
  const summaries: StrategySummary[] = [];
  for (const strategy of opts.strategies) {
    const runs = simulateMany(
      data,
      {
        ...base,
        strategy,
        winModel: opts.winModel,
        winRate: opts.winRate,
        nights,
        maxAttempts: nights * 4,
        sellSurplus: opts.sellSurplus,
        model: opts.model,
      },
      opts.seed,
      opts.runs,
    );
    runsByStrategy.set(strategy, runs);
    summaries.push(aggregateRuns(strategy, runs, data, opts.flags));
  }
  const prices = blacksmithPriceTable(data);
  const meta: ReportMeta = {
    seed: opts.seed,
    runs: opts.runs,
    winModel: opts.winModel,
    winRate: opts.winRate,
    overrides: [
      ...(opts.overridesFile ? [`file:${opts.overridesFile}`] : []),
      ...opts.sets,
    ],
    flags: opts.flags,
    generatedAt: now.toISOString(),
  };
  return {
    summaries,
    runsByStrategy,
    meta,
    console: consoleSummary(summaries, prices, meta),
    files: {
      "report.html": htmlReport(summaries, prices, meta),
      "nights.csv": nightsCsv(summaries),
      "runs.csv": runsCsv(runsByStrategy),
      "summary.json": `${JSON.stringify({ meta, prices, summaries }, null, 2)}\n`,
    },
  };
}

/** CLI entry: `scripts/econ-sim.mjs` calls this with `process.argv.slice(2)`. */
export function main(
  argv: readonly string[],
  log: (line: string) => void = (l) => process.stdout.write(`${l}\n`),
): number {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(argv);
  } catch (err) {
    log(`${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    log(USAGE);
    return 0;
  }
  const started = Date.now();
  const out = runSimulation(opts);
  mkdirSync(opts.outDir, { recursive: true });
  for (const [name, body] of Object.entries(out.files)) {
    writeFileSync(path.join(opts.outDir, name), body);
  }
  if (!opts.quiet) log(out.console);
  log(
    `\nWrote ${Object.keys(out.files)
      .map((f) => path.join(opts.outDir, f))
      .join(", ")} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  return 0;
}
