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
  --no-talents         never spend talent points (compare against talent builds)
  --model FILE         power model knobs from a fitted model file (sim:fights fit --out); flags below override it
  --still-share P      share of the fight standing still (whole bar auto-casts; default ${DEFAULT_POWER_MODEL.castStillShare})
  --moving-share P     share of the fight moving (instant spells only; default ${DEFAULT_POWER_MODEL.castMovingShare})
  --crowd-area N       area (wu²) living enemies spread over (default ${DEFAULT_POWER_MODEL.crowdAreaWu2})
  --exposure N         incoming damage × (kill time / fight time)^N (default ${DEFAULT_POWER_MODEL.exposure})
  --grace N            seconds after the last spawn to clear a wave (default ${DEFAULT_POWER_MODEL.graceSec})
  --threat N           share of enemy hits that land (default ${DEFAULT_POWER_MODEL.threatScale})
  --steepness N        win-chance curve steepness (default ${DEFAULT_POWER_MODEL.steepness})
  --weights O,D,W      offence,defence,wall exponents (default ${DEFAULT_POWER_MODEL.offenceWeight},${DEFAULT_POWER_MODEL.defenceWeight},${DEFAULT_POWER_MODEL.wallWeight}; pre-validation model: 0.5,0.25,0.25 with --steepness 3)
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
  talents: boolean;
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

function parseWeights(
  v: string | undefined,
  d: PowerModel,
): {
  offenceWeight: number;
  defenceWeight: number;
  wallWeight: number;
} {
  if (v === undefined) {
    return {
      offenceWeight: d.offenceWeight,
      defenceWeight: d.defenceWeight,
      wallWeight: d.wallWeight,
    };
  }
  const parts = v.split(",");
  if (parts.length !== 3) {
    throw new Error(`--weights needs three numbers O,D,W (got "${v}")`);
  }
  const [o, de, w] = parts.map((p) => positive("weights", p.trim(), 0));
  return { offenceWeight: o!, defenceWeight: de!, wallWeight: w! };
}

/** A fitted model file (`npm run sim:fights -- fit --out`), partial is fine. */
function loadModelFile(file: string | undefined): PowerModel {
  if (!file) return DEFAULT_POWER_MODEL;
  const raw = JSON.parse(readFileSync(file, "utf8")) as {
    model?: Partial<PowerModel>;
  } & Partial<PowerModel>;
  return { ...DEFAULT_POWER_MODEL, ...(raw.model ?? raw) };
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
      "no-talents": { type: "boolean" },
      model: { type: "string" },
      "still-share": { type: "string" },
      "moving-share": { type: "string" },
      "crowd-area": { type: "string" },
      exposure: { type: "string" },
      grace: { type: "string" },
      threat: { type: "string" },
      steepness: { type: "string" },
      weights: { type: "string" },
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
  const base = loadModelFile(values.model);
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
    talents: !values["no-talents"],
    model: {
      ...base,
      castStillShare: positive(
        "still-share",
        values["still-share"],
        base.castStillShare,
      ),
      castMovingShare: positive(
        "moving-share",
        values["moving-share"],
        base.castMovingShare,
      ),
      crowdAreaWu2: positive(
        "crowd-area",
        values["crowd-area"],
        base.crowdAreaWu2,
      ),
      exposure: positive("exposure", values.exposure, base.exposure),
      graceSec: positive("grace", values.grace, base.graceSec),
      threatScale: positive("threat", values.threat, base.threatScale),
      steepness: positive("steepness", values.steepness, base.steepness),
      ...parseWeights(values.weights, base),
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
        talents: opts.talents,
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
      ...(opts.talents ? [] : ["--no-talents"]),
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
