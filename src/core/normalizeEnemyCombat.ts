import { finalizeEnemyMeleeFxTiming } from "../combat/meleeFxTiming";
import {
  ConfigLoadError,
  optionalFiniteNumber,
  requireNumberFields,
  requireRecord,
} from "./configValidation";
import type {
  EnemyArrowRainCombat,
  EnemyAttackMovement,
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

export const ENEMY_COMBAT_WALL_KEYS = [
  "damage",
  "triggerRangeWu",
  "hitRangeWu",
] as const;
export const ENEMY_COMBAT_MELEE_KEYS = [
  "triggerRangeWu",
  "rangeWu",
  "arcDeg",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "fxStartMs",
  "vfxDisplayW",
  "vfxDisplayH",
  "vfxOffsetWu",
] as const;
export const ENEMY_COMBAT_MELEE_OPTIONAL_KEYS = ["fxDurationMs"] as const;
export const ENEMY_COMBAT_MELEE_CHASE_STANDOFF_KEY =
  "meleeChaseStandoffWu" as const;
export const ENEMY_COMBAT_ARROW_RAIN_KEYS = [
  "damage",
  "preferredRangeWu",
  "attackTriggerRangeWu",
  "kiteBandSlackWu",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "zoneRadiusWu",
  "tickIntervalMs",
  "tickDamageScale",
  "maxTicks",
] as const;
export const ENEMY_COMBAT_JAVELINEER_KEYS = [
  "damage",
  "minRangeWu",
  "maxRangeWu",
  "kiteBandSlackWu",
  "strafeSpeedMul",
  "orbitFlipMs",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "projectileSpeedWu",
  "projectileMaxTravelWu",
] as const;
export const ENEMY_COMBAT_STATIONARY_RANGED_KEYS = [
  "damage",
  "preferredRangeWu",
  "attackTriggerRangeWu",
  "kiteBandSlackWu",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "projectileSpeedWu",
  "projectileMaxTravelWu",
] as const;
export const ENEMY_COMBAT_WALL_SIEGE_KEYS = ["playerAggroRadiusWu"] as const;
export const ENEMY_COMBAT_CHARGER_KEYS = [
  "chargeDamage",
  "dashMinRangeWu",
  "dashTriggerRangeWu",
  "dashWindupMs",
  "dashDurationMs",
  "dashSpeedMul",
  "dashCooldownMs",
  "dashOvershootRangeWu",
] as const;
export const ENEMY_COMBAT_LOBBER_KEYS = [
  "damage",
  "preferredRangeWu",
  "attackTriggerRangeWu",
  "kiteBandSlackWu",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "cooldownMs",
  "projectileSpeedWu",
  "blastRadiusWu",
  "blastDamageScale",
  "impactVfxBlastMul",
  "attackCreepSpeedMul",
] as const;
export const ENEMY_COMBAT_WARD_KEYS = [
  "protectRadiusWu",
  "screenOffsetWu",
  "playerAggroRadiusWu",
] as const;
export const ENEMY_COMBAT_HYBRID_KEYS = [
  "closeMeleeRadiusWu",
  "preferredRangeWu",
  "maxMeleeSwings",
  "retreatRangeSlackWu",
] as const;

/** All boot-required combat section key lists keyed by `combat` property name. */
export const ENEMY_COMBAT_KIT_KEY_LISTS = {
  wall: ENEMY_COMBAT_WALL_KEYS,
  melee: ENEMY_COMBAT_MELEE_KEYS,
  arrowRain: ENEMY_COMBAT_ARROW_RAIN_KEYS,
  javelineer: ENEMY_COMBAT_JAVELINEER_KEYS,
  stationaryRanged: ENEMY_COMBAT_STATIONARY_RANGED_KEYS,
  wallSiege: ENEMY_COMBAT_WALL_SIEGE_KEYS,
  charger: ENEMY_COMBAT_CHARGER_KEYS,
  lobber: ENEMY_COMBAT_LOBBER_KEYS,
  ward: ENEMY_COMBAT_WARD_KEYS,
  hybrid: ENEMY_COMBAT_HYBRID_KEYS,
} as const;

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

/** Boot-required keys for `attackMovement` on phased attack kits. */
export const ENEMY_ATTACK_MOVEMENT_KEYS = [
  "windupMul",
  "activeMul",
  "recoveryMul",
] as const;

export function requireAttackMovement(
  raw: unknown,
  path: string,
): EnemyAttackMovement {
  const block = requireRecord(raw, path);
  const nums = requireNumberFields(block, ENEMY_ATTACK_MOVEMENT_KEYS, path);
  const out: EnemyAttackMovement = {
    windupMul: nums.windupMul!,
    activeMul: nums.activeMul!,
    recoveryMul: nums.recoveryMul!,
  };
  for (const key of ENEMY_ATTACK_MOVEMENT_KEYS) {
    const value = out[key];
    if (value < 0) {
      throw new ConfigLoadError(`${path}.${key} must be >= 0`);
    }
  }
  return out;
}

function withAttackMovement<T extends Record<string, number>>(
  raw: unknown,
  path: string,
  base: T,
): T & { attackMovement: EnemyAttackMovement } {
  const block = requireRecord(raw, path);
  return {
    ...base,
    attackMovement: requireAttackMovement(
      block.attackMovement,
      `${path}.attackMovement`,
    ),
  };
}

export function requireEnemyWallCombat(
  raw: unknown,
  path: string,
): EnemyWallCombat {
  return section<EnemyWallCombat>(raw, path, ENEMY_COMBAT_WALL_KEYS);
}

export function requireEnemyMeleeCombat(
  behavior: string,
  raw: unknown,
  path: string,
  enemyId: string,
): EnemyMeleeCombat {
  const block = requireRecord(raw, path);
  const base = requireNumberFields(block, ENEMY_COMBAT_MELEE_KEYS, path);
  const fxDurationMs = optionalFiniteNumber(
    block.fxDurationMs,
    `${path}.fxDurationMs`,
  );
  const preFx: Omit<EnemyMeleeCombat, "attackMovement"> = {
    triggerRangeWu: base.triggerRangeWu!,
    rangeWu: base.rangeWu!,
    arcDeg: base.arcDeg!,
    windupMs: base.windupMs!,
    activeMs: base.activeMs!,
    recoveryMs: base.recoveryMs!,
    cooldownMs: base.cooldownMs!,
    fxStartMs: base.fxStartMs!,
    fxDurationMs,
    vfxDisplayW: base.vfxDisplayW!,
    vfxDisplayH: base.vfxDisplayH!,
    vfxOffsetWu: base.vfxOffsetWu!,
  };
  if (MELEE_CHASE_STANDOFF_BEHAVIORS.has(behavior)) {
    const standoff = requireNumberFields(block, ["meleeChaseStandoffWu"], path)
      .meleeChaseStandoffWu!;
    preFx.meleeChaseStandoffWu = standoff;
  }
  const attackMovement = requireAttackMovement(
    block.attackMovement,
    `${path}.attackMovement`,
  );
  return finalizeEnemyMeleeFxTiming(enemyId, { ...preFx, attackMovement });
}

export function requireEnemyArrowRainCombat(
  raw: unknown,
  path: string,
): EnemyArrowRainCombat {
  return withAttackMovement(
    raw,
    path,
    section<Omit<EnemyArrowRainCombat, "attackMovement">>(
      raw,
      path,
      ENEMY_COMBAT_ARROW_RAIN_KEYS,
    ),
  );
}

export function requireEnemyJavelineerCombat(
  raw: unknown,
  path: string,
): EnemyJavelineerCombat {
  return withAttackMovement(
    raw,
    path,
    section<Omit<EnemyJavelineerCombat, "attackMovement">>(
      raw,
      path,
      ENEMY_COMBAT_JAVELINEER_KEYS,
    ),
  );
}

export function requireEnemyStationaryRangedCombat(
  raw: unknown,
  path: string,
): EnemyStationaryRangedCombat {
  return withAttackMovement(
    raw,
    path,
    section<Omit<EnemyStationaryRangedCombat, "attackMovement">>(
      raw,
      path,
      ENEMY_COMBAT_STATIONARY_RANGED_KEYS,
    ),
  );
}

export function requireEnemyWallSiegeCombat(
  raw: unknown,
  path: string,
): EnemyWallSiegeCombat {
  return section<EnemyWallSiegeCombat>(raw, path, ENEMY_COMBAT_WALL_SIEGE_KEYS);
}

export function requireEnemyChargerCombat(
  raw: unknown,
  path: string,
): EnemyChargerCombat {
  return section<EnemyChargerCombat>(raw, path, ENEMY_COMBAT_CHARGER_KEYS);
}

export function requireEnemyLobberCombat(
  raw: unknown,
  path: string,
): EnemyLobberCombat {
  const resolved = withAttackMovement(
    raw,
    path,
    section<Omit<EnemyLobberCombat, "attackMovement">>(
      raw,
      path,
      ENEMY_COMBAT_LOBBER_KEYS,
    ),
  );
  if (resolved.attackCreepSpeedMul < 0) {
    throw new ConfigLoadError(`${path}.attackCreepSpeedMul must be >= 0`);
  }
  return resolved;
}

export function requireEnemyWardCombat(
  raw: unknown,
  path: string,
): EnemyWardCombat {
  return section<EnemyWardCombat>(raw, path, ENEMY_COMBAT_WARD_KEYS);
}

export function requireEnemyHybridCombat(
  raw: unknown,
  path: string,
): EnemyHybridCombat {
  return section<EnemyHybridCombat>(raw, path, ENEMY_COMBAT_HYBRID_KEYS);
}

/** Required `combat` kit sections for a behavior id. */
export function behaviorCombatKitSections(
  behavior: string,
): (keyof EnemyCombatPartial)[] {
  return BEHAVIOR_KIT_SECTIONS[behavior] ?? [];
}
