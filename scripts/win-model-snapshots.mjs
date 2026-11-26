// Win-model validation, step 1 (see docs/ECONOMY_SIM.md): run the economy sim
// and export starting saves for a few nights at low / median / high gear, plus
// an under-geared save (median gear from three nights earlier), each with the
// power model's predicted win chance. e2e/win-model.spec.ts (@manual) replays
// them in the real game.
//
//   node scripts/win-model-snapshots.mjs [out.json] [--nights 5,8,10] [--runs 200]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// One module graph for every import (player tuning is module state set by
// loadSimData), so load the sim through a single temporary entry file.
const entry = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "win-model-")),
  "entry.ts",
);
fs.writeFileSync(
  entry,
  ["simulate", "simData", "power"]
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

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const out =
  args[0] && !args[0].startsWith("--")
    ? args[0]
    : path.join(root, "sim-output/win-model-snapshots.json");
const nights = flag("--nights", "5,8,10,12,15,18,20").split(",").map(Number);
const runs = Number(flag("--runs", "200"));

const { simulate: sim, simData, power } = lib;
const data = simData.loadSimData(simData.defaultRawData());

/** First-attempt starting saves per night across `runs` balanced campaigns. */
const byNight = new Map();
for (let seed = 1; seed <= runs; seed++) {
  const seen = new Set();
  sim.simulateRun(
    data,
    {
      ...sim.defaultSimOptions(data),
      onNightStart: (save, pressure) => {
        if (seen.has(save.night)) return;
        seen.add(save.night);
        const list = byNight.get(save.night) ?? [];
        list.push({ save: structuredClone(save), pressure, seed });
        byNight.set(save.night, list);
      },
    },
    seed,
  );
}

const predict = (save, night) =>
  power.nightPressure(
    power.playerPower(data.catalog, save.gear, power.DEFAULT_POWER_MODEL),
    data.nights[night - 1],
    save.townWallHpMax,
    power.DEFAULT_POWER_MODEL,
  );

/**
 * The power model assumes the spell bar is used and the better of melee or
 * ranged, so the replay auto-casts every slot and starts in that mode.
 */
const forReplay = (save) => ({
  save: {
    ...save,
    spellBar: { ...save.spellBar, autoCastSpellIds: [...save.spellBar.slots] },
  },
  mode: (() => {
    const p = power.playerPower(
      data.catalog,
      save.gear,
      power.DEFAULT_POWER_MODEL,
    );
    return p.meleeDps >= p.rangedDps ? "melee" : "ranged";
  })(),
});

const snapshots = [];
for (const night of nights) {
  const list = (byNight.get(night) ?? []).sort(
    (a, b) => a.pressure.powerRatio - b.pressure.powerRatio,
  );
  if (!list.length) continue;
  const pick = (q) =>
    list[Math.min(list.length - 1, Math.floor(q * list.length))];
  for (const [tier, q] of [
    ["p10", 0.1],
    ["p50", 0.5],
    ["p90", 0.9],
  ]) {
    const s = pick(q);
    snapshots.push({
      id: `n${night}-${tier}`,
      night,
      tier,
      seed: s.seed,
      ...forReplay(s.save),
      pressure: s.pressure,
    });
  }
  const earlier = (byNight.get(night - 3) ?? []).sort(
    (a, b) => a.pressure.powerRatio - b.pressure.powerRatio,
  );
  if (earlier.length) {
    const s = earlier[Math.floor(earlier.length / 2)];
    const save = { ...structuredClone(s.save), night };
    snapshots.push({
      id: `n${night}-behind`,
      night,
      tier: "behind",
      seed: s.seed,
      ...forReplay(save),
      pressure: predict(save, night),
    });
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(snapshots, null, 1)}\n`);
for (const s of snapshots) {
  console.log(
    `${s.id.padEnd(12)} ${s.mode.padEnd(6)} power ${s.pressure.powerRatio.toFixed(2)}  win ${(s.pressure.winChance * 100).toFixed(0)}%  wall ${s.save.townWallHpMax}`,
  );
}
console.log(
  `wrote ${snapshots.length} snapshots to ${path.relative(root, out)}`,
);
