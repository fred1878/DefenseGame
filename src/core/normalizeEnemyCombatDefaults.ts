import { requireNumberFields, requireRecord } from "./configValidation";
import type {
  EnemyArrowRainCombat,
  EnemyChargerCombat,
  EnemyCombatDefaultsBundle,
  EnemyHybridCombat,
  EnemyJavelineerCombat,
  EnemyLobberCombat,
  EnemyMeleeCombat,
  EnemyStationaryRangedCombat,
  EnemyWallCombat,
  EnemyWallSiegeCombat,
  EnemyWardCombat,
} from "./enemyTuning";

/** Authorable shape of `public/data/enemy-combat-defaults.json`. */
export type EnemyCombatDefaultsInput = Record<string, unknown>;

const WALL_KEYS = ["damage", "triggerRange", "hitRange"] as const;
const MELEE_KEYS = [
  "triggerRange",
  "range",
  "arcDeg",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "engageBodySlackPx",
] as const;
const ARROW_RAIN_KEYS = [
  "damage",
  "preferredRange",
  "attackTriggerRange",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "zoneRadius",
  "tickIntervalMs",
  "tickDamageScale",
  "maxTicks",
] as const;
const JAVELINEER_KEYS = [
  "damage",
  "minRange",
  "maxRange",
  "strafeSpeedMul",
  "orbitFlipMs",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "projectileSpeed",
  "projectileMaxTravel",
] as const;
const STATIONARY_RANGED_KEYS = [
  "damage",
  "preferredRange",
  "attackTriggerRange",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "projectileSpeed",
  "projectileMaxTravel",
] as const;
const WALL_SIEGE_KEYS = ["playerAggroRadius"] as const;
const CHARGER_KEYS = [
  "chargeDamage",
  "dashTriggerRange",
  "dashWindupMs",
  "dashDurationMs",
  "dashSpeedMul",
  "dashCooldownMs",
  "dashOvershootRange",
] as const;
const LOBBER_KEYS = [
  "damage",
  "preferredRange",
  "attackTriggerRange",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "projectileSpeed",
  "blastRadius",
  "blastDamageScale",
] as const;
const WARD_KEYS = ["protectRadius", "screenBlend", "playerAggroRadius"] as const;
const HYBRID_KEYS = [
  "closeMeleeRadius",
  "preferredRange",
  "maxMeleeSwings",
  "retreatRangeSlack",
] as const;

function section<T extends Record<string, number>>(
  raw: Record<string, unknown>,
  sectionKey: string,
  keys: readonly string[],
): T {
  const block = requireRecord(raw[sectionKey], `enemy-combat-defaults.${sectionKey}`);
  return requireNumberFields(block, keys, `enemy-combat-defaults.${sectionKey}`) as T;
}

/**
 * Require a complete `enemy-combat-defaults.json` payload (all behavior blocks and fields).
 */
export function normalizeEnemyCombatDefaults(
  raw: EnemyCombatDefaultsInput | null | undefined,
): EnemyCombatDefaultsBundle {
  const root = requireRecord(raw, "enemy-combat-defaults");
  const wall = section<EnemyWallCombat>(root, "wall", WALL_KEYS);
  const meleeFull = section<Record<string, number>>(root, "melee", MELEE_KEYS);
  const melee: EnemyMeleeCombat = {
    triggerRange: meleeFull.triggerRange!,
    range: meleeFull.range!,
    arcDeg: meleeFull.arcDeg!,
    windupMs: meleeFull.windupMs!,
    activeMs: meleeFull.activeMs!,
    recoveryMs: meleeFull.recoveryMs!,
    cooldownMs: meleeFull.cooldownMs!,
    engageBodySlackPx: meleeFull.engageBodySlackPx!,
  };
  return {
    wall,
    melee,
    arrowRain: section<EnemyArrowRainCombat>(root, "arrowRain", ARROW_RAIN_KEYS),
    javelineer: section<EnemyJavelineerCombat>(
      root,
      "javelineer",
      JAVELINEER_KEYS,
    ),
    stationaryRanged: section<EnemyStationaryRangedCombat>(
      root,
      "stationaryRanged",
      STATIONARY_RANGED_KEYS,
    ),
    wallSiege: section<EnemyWallSiegeCombat>(root, "wallSiege", WALL_SIEGE_KEYS),
    charger: section<EnemyChargerCombat>(root, "charger", CHARGER_KEYS),
    lobber: section<EnemyLobberCombat>(root, "lobber", LOBBER_KEYS),
    ward: section<EnemyWardCombat>(root, "ward", WARD_KEYS),
    hybrid: section<EnemyHybridCombat>(root, "hybrid", HYBRID_KEYS),
  };
}