// Real-fight harness for the economy sim's win model (docs/ECONOMY_SIM.md,
// "Checking the model against real fights").
//
//   npm run sim:fights -- [run] [--nights 3,5,10] [--strategies balanced,no-spend]
//       [--tiers p10,p50,p90] [--behind] [--repeats 1] [--runs 150]
//       [--overrides candidate.json] [--out sim-output/fights/NAME]
//       [--workers 8] [--build] [--full-cast] [--bars cooldown,frost,lightning]
//       [--schools generic,fire,frost,lightning] [--no-auto-attack]
//       [--saves DIR/snapshots.json] [--resume]
//   npm run sim:fights -- report DIR [DIR...]   predicted vs real (current model)
//   npm run sim:fights -- fit DIR [DIR...]      refit the model knobs
//       [--min-night 13] [--model start.json] [--fix knob=v,...] [--out fitted.json]
//   npm run sim:fights -- tally DIR [DIR...]    damage tally vs the model's DPS
//   (report, fit and tally also take --model fitted.json)
//
// `run` plays the economy sim per strategy, saves the starting save of each
// chosen night at low / median / high power (and, with --behind, a save from
// three nights earlier), replays every save in the real game through
// e2e/win-model.spec.ts (headless Chromium, campaign waves, a simple bot) and
// writes snapshots.json, results.jsonl and summary.md to the out folder.
// --overrides is a sim overrides file ({ "waves": { ... } }); its waves,
// enemies, spells and player parts are also served to the game, so candidate
// waves can be tried without rebuilding.
// --full-cast: the bot holds still through every windup / channel and stops
// to let ready windup spells start (nothing cancels a cast).
// --bars: replay each save once per spell bar: cooldown (the save's own
// spells: cooldown spells longest first, heals, one filler last; default),
// frost or lightning (an element-focused bar, src/sim/economy/spellBars.ts).
// Extra bars are labelled strategy/bar; gear and talents are the save's own.
// --schools: replay each save once per school build: generic (the save
// as it is, cooldown bar) or fire / frost / lightning (the same items and
// talent points rebuilt for that school, src/sim/economy/schoolBuilds.ts).
// Labelled strategy/school; replaces --bars.
// --no-auto-attack: the bot turns the HUD auto attack off, so the
// player never swings or shoots (only spells, bombs and potions).
// --saves DIR/snapshots.json: replay an earlier run's saves instead of
// playing the sim again (same gear, talents and gold; bars rebuilt).
// --resume: keep the out folder's results and play only the missing fights.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// One module graph for every import (configs are module state set by
// loadSimData), so load the sim through a single temporary entry file.
const entry = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "sim-fights-")),
  "entry.ts",
);
fs.writeFileSync(
  entry,
  ["simulate", "simData", "power", "fights", "spellBars", "schoolBuilds"]
    .map(
      (m) =>
        `export * as ${m} from ${JSON.stringify(path.join(root, "src/sim/economy", `${m}.ts`))};`,
    )
    .join("\n"),
);
const { module: lib } = await runnerImport(entry, {
  root,
  configFile: false,
  logLevel: "error",
});
const { simulate: sim, simData, power, fights, spellBars, schoolBuilds } = lib;

const argv = process.argv.slice(2);
const command = ["run", "report", "fit", "tally"].includes(argv[0])
  ? argv.shift()
  : "run";
const flags = new Map();
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) positional.push(a);
  else if (
    [
      "--behind",
      "--build",
      "--full-cast",
      "--no-auto-attack",
      "--resume",
    ].includes(a)
  )
    flags.set(a, "1");
  else flags.set(a, argv[++i]);
}
const flag = (name, fallback) => flags.get(name) ?? fallback;
const list = (name, fallback) =>
  flag(name, fallback).split(",").filter(Boolean);

/** Served-to-game data files an overrides file may change. */
const GAME_FILES = ["waves", "enemies", "spells", "player"];

function loadData(overrides) {
  const raw = simData.defaultRawData();
  if (overrides) simData.applyOverridesObject(raw, overrides);
  return { raw, data: simData.loadSimData(raw) };
}

function readOverrides(dir) {
  const file = path.join(dir, "overrides.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function modeFor(data, save) {
  const p = power.playerPower(
    data.catalog,
    save.gear,
    power.DEFAULT_POWER_MODEL,
  );
  return p.meleeDps >= p.rangedDps ? "melee" : "ranged";
}

/**
 * Spell bar for the replay, padded to the save's slot count. `cooldown`:
 * the save's own spells, cooldown spells longest first, then heals, then
 * one filler last (src/sim/economy/spellBars.ts). `frost` / `lightning`:
 * an element-focused bar from spellBars.elementBar. Gear and talents stay
 * the save's own.
 */
function barOrder(slots, bar) {
  const ordered =
    bar === "cooldown"
      ? spellBars.autoCastOrder(slots)
      : spellBars.elementBar(slots, bar, slots.length);
  return [
    ...ordered,
    ...Array(Math.max(0, slots.length - ordered.length)).fill(""),
  ];
}

/** Copies of each snapshot per extra `--bars` order, labelled strategy/bar. */
function withBars(snaps, bars) {
  return bars.flatMap((bar) =>
    snaps.map((snap) => {
      if (bar === "cooldown") return snap;
      const slots = barOrder(snap.save.spellBar.slots, bar);
      return {
        ...snap,
        id: snap.id.replace(snap.strategy, `${snap.strategy}/${bar}`),
        strategy: `${snap.strategy}/${bar}`,
        save: {
          ...snap.save,
          spellBar: {
            ...snap.save.spellBar,
            slots,
            autoCastSpellIds: [...slots],
          },
        },
      };
    }),
  );
}

/** Copies of each snapshot per `--schools` build, labelled strategy/school. */
function withSchools(data, snaps, schools) {
  return schools.flatMap((school) =>
    snaps.map((snap) => ({
      ...snap,
      id: snap.id.replace(snap.strategy, `${snap.strategy}/${school}`),
      strategy: `${snap.strategy}/${school}`,
      save:
        school === "generic"
          ? snap.save
          : schoolBuilds.schoolSave(
              data.catalog,
              data.talents,
              snap.save,
              school,
            ),
    })),
  );
}

/**
 * Auto-cast every spell-bar slot, longest cooldown first (auto-cast takes
 * the first ready slot, so a no-cooldown filler in front starves the rest);
 * the power model assumes the same rotation.
 */
function forReplay(data, save) {
  const slots = barOrder(save.spellBar.slots, "cooldown");
  return {
    save: {
      ...save,
      spellBar: { ...save.spellBar, slots, autoCastSpellIds: [...slots] },
    },
    mode: modeFor(data, save),
  };
}

/**
 * Saves from an earlier run's snapshots.json (`--saves`), so a rerun plays
 * the very same saves; extra-bar copies are skipped and the spell bar is
 * rebuilt with the current ordering.
 */
function savedSnapshots(data, file, strategies, nights, tiers) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"))
    .filter(
      (snap) =>
        strategies.includes(snap.strategy) &&
        nights.includes(snap.night) &&
        tiers.includes(snap.tier),
    )
    .map((snap) => ({ ...snap, ...forReplay(data, snap.save) }));
}

function snapshotsFor(data, strategy, nights, tiers, runs, behind) {
  const byNight = new Map();
  for (let seed = 1; seed <= runs; seed++) {
    const seen = new Set();
    sim.simulateRun(
      data,
      {
        ...sim.defaultSimOptions(data),
        strategy,
        onNightStart: (save, pressure) => {
          if (seen.has(save.night)) return;
          seen.add(save.night);
          const l = byNight.get(save.night) ?? [];
          l.push({ save: structuredClone(save), pressure, seed });
          byNight.set(save.night, l);
        },
      },
      seed,
    );
  }
  const out = [];
  const sorted = (n) =>
    (byNight.get(n) ?? []).sort(
      (a, b) => a.pressure.powerRatio - b.pressure.powerRatio,
    );
  for (const night of nights) {
    const l = sorted(night);
    if (!l.length) continue;
    for (const tier of tiers) {
      const q = Number(tier.replace(/^p/, "")) / 100;
      const s = l[Math.min(l.length - 1, Math.floor(q * l.length))];
      out.push({
        id: `${strategy}-n${night}-${tier}`,
        night,
        tier,
        strategy,
        seed: s.seed,
        ...forReplay(data, s.save),
      });
    }
    const earlier = sorted(night - 3);
    if (behind && earlier.length) {
      const s = earlier[Math.floor(earlier.length / 2)];
      const save = { ...structuredClone(s.save), night };
      out.push({
        id: `${strategy}-n${night}-behind`,
        night,
        tier: "behind",
        strategy,
        seed: s.seed,
        ...forReplay(data, save),
      });
    }
  }
  return out;
}

function outcomes(dirs, model) {
  const rows = [];
  for (const dir of dirs) {
    const { data } = loadData(readOverrides(dir));
    const snaps = new Map(
      JSON.parse(fs.readFileSync(path.join(dir, "snapshots.json"), "utf8")).map(
        (s) => [s.id, s],
      ),
    );
    const file = path.join(dir, "results.jsonl");
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const snap = snaps.get(r.id);
      if (!snap) continue;
      rows.push({
        night: r.night,
        strategy: snap.strategy,
        tier: snap.tier,
        won: r.won,
        predicted: fights.savePressure(data, snap.save, model).winChance,
        sample: fights.fightSample(data, snap.save),
        tally: r.tally ?? {},
        // Mean enemies alive over the sampled seconds (trace rows are [alive, wall, hp]).
        alive: r.trace?.length
          ? r.trace.reduce((a, t) => a + t[0], 0) / r.trace.length
          : 0,
        seconds: r.seconds,
      });
    }
  }
  return rows;
}

function runFights() {
  const nights = list("--nights", "3,5,7,9,10,12,14,16,18,20").map(Number);
  const strategies = list(
    "--strategies",
    "balanced,spell-caster,ranged,no-spend",
  );
  const tiers = list("--tiers", "p10,p50,p90");
  const runs = Number(flag("--runs", "150"));
  const repeats = Number(flag("--repeats", "1"));
  const overridesFile = flag("--overrides", "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const out = path.resolve(root, flag("--out", `sim-output/fights/${stamp}`));
  fs.mkdirSync(out, { recursive: true });
  const overrides = overridesFile
    ? JSON.parse(fs.readFileSync(overridesFile, "utf8"))
    : null;
  const { raw, data } = loadData(overrides);
  let dataDir = "";
  if (overrides) {
    fs.writeFileSync(
      path.join(out, "overrides.json"),
      JSON.stringify(overrides, null, 1),
    );
    dataDir = path.join(out, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    for (const id of GAME_FILES) {
      if (id in overrides)
        fs.writeFileSync(
          path.join(dataDir, `${id}.json`),
          JSON.stringify(raw[id]),
        );
    }
  }
  const base = flag("--saves", "")
    ? savedSnapshots(data, flag("--saves", ""), strategies, nights, tiers)
    : strategies.flatMap((s, i) =>
        snapshotsFor(
          data,
          s,
          nights,
          tiers,
          runs,
          flags.has("--behind") && i === 0,
        ),
      );
  const snaps = flags.has("--schools")
    ? withSchools(data, base, list("--schools", ""))
    : withBars(base, list("--bars", "cooldown"));
  fs.writeFileSync(
    path.join(out, "snapshots.json"),
    `${JSON.stringify(snaps)}\n`,
  );
  console.log(
    `${snaps.length} snapshots × ${repeats} → ${path.relative(root, out)}`,
  );
  if (
    flags.has("--build") ||
    !fs.existsSync(path.join(root, "dist/index.html"))
  ) {
    const b = spawnSync("npm", ["run", "build:e2e"], {
      cwd: root,
      stdio: "inherit",
    });
    if (b.status !== 0) process.exit(b.status ?? 1);
  }
  const results = path.join(out, "results.jsonl");
  // --resume: keep finished fights and play only the snapshots missing a
  // result (needs the same snapshots, e.g. with --saves).
  let toPlay = path.join(out, "snapshots.json");
  if (flags.has("--resume") && fs.existsSync(results)) {
    const done = new Set(
      fs
        .readFileSync(results, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const r = JSON.parse(line);
          return `${r.id}#${r.rep}`;
        }),
    );
    const pending = snaps.filter(
      (s) =>
        !Array.from({ length: repeats }, (_, i) => `${s.id}#${i + 1}`).every(
          (k) => done.has(k),
        ),
    );
    toPlay = path.join(out, "pending.json");
    fs.writeFileSync(toPlay, `${JSON.stringify(pending)}\n`);
    console.log(`resuming: ${pending.length} snapshots still to play`);
  } else {
    fs.rmSync(results, { force: true });
  }
  const p = spawnSync(
    "npx",
    [
      "playwright",
      "test",
      "e2e/win-model.spec.ts",
      "--project=chromium",
      "--reporter=dot",
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        E2E_WORKERS: flag("--workers", "8"),
        WIN_MODEL_FULL_CAST: flags.has("--full-cast") ? "1" : "",
        WIN_MODEL_AUTO_ATTACK: flags.has("--no-auto-attack") ? "0" : "1",
        WIN_MODEL_SNAPSHOTS: toPlay,
        WIN_MODEL_RESULTS: results,
        WIN_MODEL_REPEATS: String(repeats),
        WIN_MODEL_DATA_DIR: dataDir,
      },
    },
  );
  if (p.status !== 0)
    console.warn(`playwright exited ${p.status}; reporting what finished`);
  report([out]);
}

/** `--model file.json` (a fitted model, partial is fine) over the defaults. */
function modelFlag() {
  const file = flag("--model", "");
  const m = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  return { ...power.DEFAULT_POWER_MODEL, ...(m.model ?? m) };
}

function report(dirs) {
  const rows = outcomes(dirs, modelFlag());
  const md = fights.fightSummaryMarkdown(fights.summarizeFights(rows));
  if (dirs.length === 1) fs.writeFileSync(path.join(dirs[0], "summary.md"), md);
  console.log(md);
}

/**
 * Fit on nights >= --min-night (default 13); earlier nights are held out
 * and only scored. Writes the fitted model to --out (default stdout).
 */
function runFit(dirs) {
  // --fix steepness=3,exposure=1 pins knobs (set, and left out of the search).
  const fixed = Object.fromEntries(
    list("--fix", "").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, Number(v)];
    }),
  );
  const start = { ...modelFlag(), ...fixed };
  const grid = Object.fromEntries(
    Object.entries(fights.FIT_GRID).filter(([k]) => !(k in fixed)),
  );
  const rows = outcomes(dirs, start);
  const minNight = Number(flag("--min-night", "13"));
  const sample = (r) => ({ ...r.sample, won: r.won });
  const train = rows.filter((r) => r.night >= minNight).map(sample);
  const held = rows.filter((r) => r.night < minNight).map(sample);
  const best = fights.fitPowerModel(train, start, grid);
  const result = {
    ...best,
    trainFights: train.length,
    heldOutFights: held.length,
    heldOutStartLogLoss: held.length ? fights.modelLogLoss(held, start) : null,
    heldOutLogLoss: held.length ? fights.modelLogLoss(held, best.model) : null,
  };
  const text = `${JSON.stringify(result, null, 1)}\n`;
  const out = flag("--out", "");
  if (out) fs.writeFileSync(out, text);
  console.log(text);
}

/**
 * Damage tally vs the model: weapon (physical) damage per second over the
 * model's single-target weapon DPS (≈ enemies hit per swing × uptime), and
 * element damage per second over the bar's moving / still single-target DPS.
 */
function tally(dirs) {
  const rows = outcomes(dirs, modelFlag());
  const byNight = new Map();
  const perFight = [];
  for (const r of rows) {
    const t = r.tally;
    const sec = Math.max(1, r.seconds);
    const phys = (t.physical?.damage ?? 0) / sec;
    const elem =
      Object.entries(t)
        .filter(([k]) => k !== "physical")
        .reduce((a, [, v]) => a + v.damage, 0) / sec;
    const p = r.sample.power;
    const moving = p.spells.reduce((a, s) => a + s.movingDps * s.mult, 0);
    const still = p.spells.reduce((a, s) => a + s.stillDps * s.mult, 0);
    const l = byNight.get(r.night) ?? [];
    l.push({
      phys: phys / p.weaponDps,
      elemMoving: elem / moving,
      elemStill: elem / still,
    });
    perFight.push({
      night: r.night,
      strategy: r.strategy,
      won: r.won,
      phys,
      elem,
      weaponDps: p.weaponDps,
      meleeBest: p.meleeBest,
      meleeAreaWu2: p.meleeAreaWu2,
      moving,
      still,
      alive: r.alive,
    });
    byNight.set(r.night, l);
  }
  const mean = (l, k) => l.reduce((a, x) => a + x[k], 0) / l.length;
  console.log(
    "| Night | Fights | Weapon dmg/s ÷ weapon DPS | Element dmg/s ÷ moving bar DPS | ÷ still bar DPS |",
  );
  console.log("|---|---|---|---|---|");
  for (const n of [...byNight.keys()].sort((a, b) => a - b)) {
    const l = byNight.get(n);
    console.log(
      `| ${n} | ${l.length} | ${mean(l, "phys").toFixed(2)} | ${mean(l, "elemMoving").toFixed(2)} | ${mean(l, "elemStill").toFixed(2)} |`,
    );
  }
  const out = flag("--out", "");
  if (out) fs.writeFileSync(out, JSON.stringify(perFight));
}

if (command === "run") runFights();
else if (command === "tally") tally(positional);
else if (command === "report") report(positional);
else runFit(positional);
