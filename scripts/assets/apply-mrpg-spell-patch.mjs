#!/usr/bin/env node
/** One-shot MobileRPG timing/effect patch for spells.json (until sync-spells-from-mobilerpg.py has the .c file). */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const path = join(root, "public/data/spells.json");
const data = JSON.parse(readFileSync(path, "utf8"));

/** @type {Record<string, object>} */
const PATCH = {
  fire_bolt: {
    castMs: 300,
    cooldownMs: 0,
    onHit: { dotDps: 4, dotMs: 2500 },
  },
  ice_bolt: {
    castMs: 200,
    cooldownMs: 0,
    onHit: { slowPct: 0.5, slowMs: 4000 },
  },
  lightning_bolt: { castMs: 550, cooldownMs: 3000 },
  water_bolt: { castMs: 0, cooldownMs: 350 },
  arc_bomb: { castMs: 300, cooldownMs: 4000, blastRadius: 56 },
  swing: { cooldownMs: 300, targetMode: "enemy" },
  rend: {
    castMs: 200,
    channelMs: 0,
    cooldownMs: 600,
    onHit: { dotDps: 8, dotMs: 3000 },
  },
  cone_of_cold: {
    cooldownMs: 7000,
    coneRangeWu: 130,
    onHit: { slowPct: 0.4, slowMs: 2000 },
  },
  cone_of_fire: {
    mechanicType: "channeled_cone",
    castMs: 0,
    channelMs: 750,
    channelTickMs: 250,
    cooldownMs: 6000,
    coneRangeWu: 220,
    onHit: { dotDps: 5, dotMs: 5000 },
  },
  fire_blast: { cooldownMs: 10000, centerOnCaster: false, targetMode: "none" },
  fire_nova: {
    cooldownMs: 30000,
    blastRadius: 50,
    centerOnCaster: true,
    onHit: { dotDps: 8, dotMs: 3000 },
  },
  blizzard: {
    castMs: 800,
    channelMs: 4000,
    cooldownMs: 1100,
    blastRadius: 80,
    channelTickMs: 250,
    targetMode: "ground",
    groundTargetMaxRangeWu: 240,
    onHit: { slowPct: 0.4, slowMs: 2000 },
  },
  meteor: {
    castMs: 1100,
    channelMs: 0,
    cooldownMs: 20000,
    blastRadius: 44,
    targetMode: "ground",
    onHit: { dotDps: 8, dotMs: 3000 },
  },
  frost_nova: {
    cooldownMs: 10000,
    blastRadius: 85,
    centerOnCaster: true,
    onHit: { rootMs: 1400 },
  },
  flamestrike: {
    castMs: 650,
    channelMs: 0,
    cooldownMs: 8500,
    blastRadius: 78,
    baseDamage: 24,
    lingerMs: 3000,
    lingerTickMs: 250,
    targetMode: "ground",
    groundTargetMaxRangeWu: 240,
    onHit: { dotDps: 6, dotMs: 3000 },
  },
  deep_freeze: {
    castMs: 550,
    channelMs: 0,
    cooldownMs: 9000,
    targetMode: "enemy",
    requireEnemyTarget: true,
    onHit: { dotDps: 7, dotMs: 4000, rootMs: 2000 },
  },
  chain_lightning: {
    castMs: 450,
    channelMs: 0,
    cooldownMs: 7500,
    targetMode: "enemy",
    requireEnemyTarget: true,
  },
  combustion: {
    castMs: 450,
    channelMs: 0,
    cooldownMs: 8000,
    burstDamage: 22,
    blastRadius: 64,
    targetMode: "enemy",
    requireEnemyTarget: true,
    onHit: { dotDps: 2.5, dotMs: 3500 },
  },
  heal: { targetMode: "self", channelTickMs: 0 },
};

for (const spell of data.spells) {
  const patch = PATCH[spell.id];
  if (!patch) continue;
  Object.assign(spell, patch);
}

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log("patched spells.json", Object.keys(PATCH).length);
