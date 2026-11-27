import consumablesJson from "../../../public/data/consumables.json";
import buildingsJson from "../../../public/data/buildings.json";
import enemiesJson from "../../../public/data/enemies.json";
import itemsJson from "../../../public/data/items.json";
import lootJson from "../../../public/data/loot.json";
import playerJson from "../../../public/data/player.json";
import shopsJson from "../../../public/data/shops.json";
import spellsJson from "../../../public/data/spells.json";
import talentsJson from "../../../public/data/talents.json";
import wavesJson from "../../../public/data/waves.json";
import { applyPlayerTuning } from "../../config/player";
import { setSpellCatalog, type SpellDefinition } from "../../content/spells";
import type { BuildingDef } from "../../core/DataStore";
import { normalizeConsumables } from "../../core/normalizeConsumables";
import { normalizeItems } from "../../core/normalizeItems";
import { normalizeLoot } from "../../core/normalizeLoot";
import { normalizePlayerConfig } from "../../core/normalizePlayer";
import { normalizeShops } from "../../core/normalizeShops";
import { normalizeSpellCatalog } from "../../core/normalizeSpells";
import { normalizeTalents } from "../../core/normalizeTalents";
import { setTalentCatalog } from "../../talents/talentCatalog";
import type { TalentCatalog } from "../../talents/talentTypes";
import { setConsumablesConfig } from "../../gear/consumables";
import type { ConsumablesConfig } from "../../gear/consumableTypes";
import { setGearCatalog } from "../../gear/gearCatalog";
import type { GearCatalog } from "../../gear/gearTypes";
import { setLootConfig, type LootConfig } from "../../gear/loot";
import { setShopsConfig, type ShopsConfig } from "../../gear/shops";

/** Data files the simulator reads (keys are the `--set` prefixes). */
export const SIM_FILE_IDS = [
  "items",
  "loot",
  "shops",
  "consumables",
  "waves",
  "buildings",
  "player",
  "enemies",
  "spells",
  "talents",
] as const;
export type SimFileId = (typeof SIM_FILE_IDS)[number];
export type SimRawData = Record<SimFileId, unknown>;

/** Fresh deep copy of the shipped `public/data` files. */
export function defaultRawData(): SimRawData {
  return structuredClone({
    items: itemsJson,
    loot: lootJson,
    shops: shopsJson,
    consumables: consumablesJson,
    waves: wavesJson,
    buildings: buildingsJson,
    player: playerJson,
    enemies: enemiesJson,
    spells: spellsJson,
    talents: talentsJson,
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** `"3"` → 3, `"true"` → true, `'{"a":1}'` → object; anything else stays a string. */
export function parseOverrideValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Apply one `file.path.to.key=value` override in place, e.g.
 * `loot.tables.nightWon.maxRolls=3` or `waves.5.rewardGold=90`.
 * Array indices are plain numbers (`shops.trader.consumables.0.qty=5`).
 */
export function applySetOverride(raw: SimRawData, expr: string): void {
  const eq = expr.indexOf("=");
  if (eq <= 0) throw new Error(`Bad --set "${expr}" (expected path=value)`);
  const path = expr.slice(0, eq).trim().split(".");
  const value = parseOverrideValue(expr.slice(eq + 1).trim());
  const file = path.shift() as SimFileId;
  if (!SIM_FILE_IDS.includes(file)) {
    throw new Error(
      `Unknown data file "${file}" in --set (use ${SIM_FILE_IDS.join(", ")})`,
    );
  }
  const last = path.pop();
  if (last === undefined) throw new Error(`--set "${expr}" needs a key path`);
  let node: unknown = raw[file];
  for (const key of path) {
    const next = (node as Record<string, unknown>)[key];
    if (!next || typeof next !== "object") {
      throw new Error(`--set "${expr}": "${key}" not found`);
    }
    node = next;
  }
  (node as Record<string, unknown>)[last] = value;
}

/** Deep-merge `patch` into `target` (objects merge, arrays and scalars replace). */
export function deepMerge(target: unknown, patch: unknown): unknown {
  if (!isRecord(target) || !isRecord(patch)) return structuredClone(patch);
  const out: Record<string, unknown> = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = k in target ? deepMerge(target[k], v) : structuredClone(v);
  }
  return out;
}

/** Apply an overrides object shaped like `{ "loot": { ... }, "waves": { ... } }`. */
export function applyOverridesObject(raw: SimRawData, patch: unknown): void {
  if (!isRecord(patch)) throw new Error("Overrides file must be a JSON object");
  for (const [file, value] of Object.entries(patch)) {
    if (!SIM_FILE_IDS.includes(file as SimFileId)) {
      throw new Error(`Unknown data file "${file}" in overrides`);
    }
    const id = file as SimFileId;
    raw[id] = deepMerge(raw[id], value);
  }
}

/** One campaign night's reward and enemy totals (from `waves.json` × `enemies.json`). */
export type NightDifficulty = {
  night: number;
  rewardGold: number;
  enemyCount: number;
  /** Sum of enemy HP (group `hpMul` applied; damage totals use `damageMul`). */
  totalHp: number;
  /** Sum of one hit from every enemy against the player. */
  totalDamage: number;
  /** Sum of one hit from every enemy against the wall. */
  totalWallDamage: number;
  /** Seconds from the first to the last spawn. */
  spawnSpanSec: number;
};

type RawEnemy = {
  hp?: unknown;
  damage?: unknown;
  combat?: { wall?: { damage?: unknown } };
};
type RawGroup = {
  atMs?: unknown;
  enemyId?: unknown;
  count?: unknown;
  intervalMs?: unknown;
  hpMul?: unknown;
  damageMul?: unknown;
};

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export function waveDifficulties(
  wavesRaw: unknown,
  enemiesRaw: unknown,
): NightDifficulty[] {
  if (!isRecord(wavesRaw) || !isRecord(enemiesRaw)) {
    throw new Error("waves.json and enemies.json must be objects");
  }
  const out: NightDifficulty[] = [];
  for (const [key, row] of Object.entries(wavesRaw)) {
    const night = Number(key);
    if (!Number.isInteger(night) || !isRecord(row)) continue;
    const groups = Array.isArray(row.groups) ? (row.groups as RawGroup[]) : [];
    const d: NightDifficulty = {
      night,
      rewardGold: num(row.rewardGold),
      enemyCount: 0,
      totalHp: 0,
      totalDamage: 0,
      totalWallDamage: 0,
      spawnSpanSec: 0,
    };
    for (const g of groups) {
      const enemy = enemiesRaw[String(g.enemyId)] as RawEnemy | undefined;
      if (!enemy) {
        throw new Error(`waves.${key}: unknown enemy "${String(g.enemyId)}"`);
      }
      const count = num(g.count);
      d.enemyCount += count;
      const hpMul = num(g.hpMul) > 0 ? num(g.hpMul) : 1;
      const dmgMul = num(g.damageMul) > 0 ? num(g.damageMul) : 1;
      d.totalHp += count * num(enemy.hp) * hpMul;
      d.totalDamage += count * num(enemy.damage) * dmgMul;
      d.totalWallDamage += count * num(enemy.combat?.wall?.damage) * dmgMul;
      const lastMs = num(g.atMs) + Math.max(0, count - 1) * num(g.intervalMs);
      d.spawnSpanSec = Math.max(d.spawnSpanSec, lastMs / 1000);
    }
    out.push(d);
  }
  return out.sort((a, b) => a.night - b.night);
}

export type SimData = {
  catalog: GearCatalog;
  loot: LootConfig;
  shops: ShopsConfig;
  consumables: ConsumablesConfig;
  buildings: Record<string, BuildingDef>;
  nights: NightDifficulty[];
  spells: SpellDefinition[];
  talents: TalentCatalog;
};

/**
 * Validate the raw files with the game's own normalizers and install them as
 * the active configs, so shared game code (loot, shops, saves) reads them.
 */
export function loadSimData(raw: SimRawData): SimData {
  const catalog = normalizeItems(raw.items);
  const loot = normalizeLoot(raw.loot);
  const shops = normalizeShops(raw.shops);
  const consumables = normalizeConsumables(raw.consumables);
  const talents = normalizeTalents(raw.talents);
  const { endlessPanelDefaultConcurrent: _ui, ...tuning } =
    normalizePlayerConfig(
      raw.player as Parameters<typeof normalizePlayerConfig>[0],
    );
  const spells = normalizeSpellCatalog(
    raw.spells as Parameters<typeof normalizeSpellCatalog>[0],
  );
  if (!isRecord(raw.buildings))
    throw new Error("buildings.json must be an object");
  const buildings = raw.buildings as Record<string, BuildingDef>;
  setGearCatalog(catalog);
  setLootConfig(loot);
  setShopsConfig(shops);
  setConsumablesConfig(consumables);
  applyPlayerTuning(tuning);
  setSpellCatalog(spells);
  setTalentCatalog(talents);
  return {
    catalog,
    loot,
    shops,
    consumables,
    buildings,
    nights: waveDifficulties(raw.waves, raw.enemies),
    spells,
    talents,
  };
}
