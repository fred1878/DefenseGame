import { requireNumberFields, requireRecord } from "./configValidation";
import type {
  EnemyArrowRainCombat,
  EnemyChargerCombat,
  EnemyHybridCombat,
  EnemyJavelineerCombat,
  EnemyLobberCombat,
  EnemyMeleeCombat,
  EnemyStationaryRangedCombat,
  EnemyWallCombat,
  EnemyWallSiegeCombat,
  EnemyWardCombat,
  EnemyCombatPartial,
} from "./enemyTuning";

const MELEE_CHASE_STANDOFF_BEHAVIORS = new Set([
  "meleeChaser",
  "bruiser",
  "wallSiege",
  "charger",
  "ward",
  "javelineer",
  "rangedHybrid",
]);

const WALL_KEYS = ["damage", "triggerRange", "hitRange"] as const;
const MELEE_KEYS = [
  "triggerRange",
  "range",
  "arcDeg",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
] as const;
const ARROW_RAIN_KEYS = [
  "damage",
  "preferredRange",
  "attackTriggerRange",
  "kiteBandSlackWu",
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
  "kiteBandSlackWu",
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
  "kiteBandSlackWu",
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
  "dashMinRange",
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
  "kiteBandSlackWu",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "projectileSpeed",
  "blastRadius",
  "blastDamageScale",
] as const;
const WARD_KEYS = ["protectRadius", "screenOffsetWu", "playerAggroRadius"] as const;
const HYBRID_KEYS = [
  "closeMeleeRadius",
  "preferredRange",
  "maxMeleeSwings",
  "retreatRangeSlack",
] as const;

const BEHAVIOR_KIT_SECTIONS: Record<string, (keyof EnemyCombatPartial)[]> = {
  arrowRainArcher: ["arrowRain"],
  javelineer: ["javelineer"],
  stationaryRanged: ["stationaryRanged"],
  wallSiege: ["wallSiege"],
  charger: ["charger"],
  lobber: ["lobber"],
  ward: ["ward"],
  rangedHybrid: ["stationaryRanged", "hybrid"],
};

function section<T extends Record<string, number>>(
  raw: unknown,
  path: string,
  keys: readonly string[],
): T {
  const block = requireRecord(raw, path);
  return requireNumberFields(block, keys, path) as T;
}

export function requireEnemyWallCombat(
  raw: unknown,
  path: string,
): EnemyWallCombat {
  return section<EnemyWallCombat>(raw, path, WALL_KEYS);
}

export function requireEnemyMeleeCombat(
  behavior: string,
  raw: unknown,
  path: string,
): EnemyMeleeCombat {
  const block = requireRecord(raw, path);
  const base = requireNumberFields(block, MELEE_KEYS, path) as EnemyMeleeCombat;
  if (!MELEE_CHASE_STANDOFF_BEHAVIORS.has(behavior)) {
    return base;
  }
  const standoff = requireNumberFields(
    block,
    ["meleeChaseStandoffWu"],
    path,
  ).meleeChaseStandoffWu!;
  return { ...base, meleeChaseStandoffWu: standoff };
}

export function requireEnemyArrowRainCombat(
  raw: unknown,
  path: string,
): EnemyArrowRainCombat {
  return section<EnemyArrowRainCombat>(raw, path, ARROW_RAIN_KEYS);
}

export function requireEnemyJavelineerCombat(
  raw: unknown,
  path: string,
): EnemyJavelineerCombat {
  return section<EnemyJavelineerCombat>(raw, path, JAVELINEER_KEYS);
}

export function requireEnemyStationaryRangedCombat(
  raw: unknown,
  path: string,
): EnemyStationaryRangedCombat {
  return section<EnemyStationaryRangedCombat>(raw, path, STATIONARY_RANGED_KEYS);
}

export function requireEnemyWallSiegeCombat(
  raw: unknown,
  path: string,
): EnemyWallSiegeCombat {
  return section<EnemyWallSiegeCombat>(raw, path, WALL_SIEGE_KEYS);
}

export function requireEnemyChargerCombat(
  raw: unknown,
  path: string,
): EnemyChargerCombat {
  return section<EnemyChargerCombat>(raw, path, CHARGER_KEYS);
}

export function requireEnemyLobberCombat(
  raw: unknown,
  path: string,
): EnemyLobberCombat {
  return section<EnemyLobberCombat>(raw, path, LOBBER_KEYS);
}

export function requireEnemyWardCombat(raw: unknown, path: string): EnemyWardCombat {
  return section<EnemyWardCombat>(raw, path, WARD_KEYS);
}

export function requireEnemyHybridCombat(
  raw: unknown,
  path: string,
): EnemyHybridCombat {
  return section<EnemyHybridCombat>(raw, path, HYBRID_KEYS);
}

/** Required `combat` kit sections for a behavior id. */
export function behaviorCombatKitSections(
  behavior: string,
): (keyof EnemyCombatPartial)[] {
  return BEHAVIOR_KIT_SECTIONS[behavior] ?? [];
}