import { ConfigLoadError, requireFiniteNumber } from "./configValidation";
import {
  MELEE_CHASE_STANDOFF_BEHAVIORS,
  resolveEnemyCombat,
  type EnemyCombatPartial,
} from "./enemyTuning";
import type { EnemyDef } from "./DataStore";

/** Boot-required top-level keys on each `enemies.json` row (see `DATA_FIELDS.md`). */
export const ENEMY_ROW_BOOT_KEYS = [
  "hp",
  "speedWu",
  "damage",
  "bodyRadiusWu",
  "weight",
  "challengeRating",
  "behavior",
  "textureKey",
  "combat",
] as const;

export const ENEMY_ROW_OPTIONAL_BOOT_KEYS = ["displayName"] as const;

export type EnemyDefInput = {
  hp?: number;
  speedWu?: number;
  damage?: number;
  bodyRadiusWu?: number;
  weight?: number;
  challengeRating?: number;
  behavior: string;
  textureKey: string;
  displayName?: string;
  combat?: EnemyCombatPartial;
};

function titleCaseFromId(id: string): string {
  return id
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function normalizeEnemyRow(id: string, raw: EnemyDefInput): EnemyDef {
  const path = `enemies.${id}`;
  if (raw.hp === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.hp`);
  }
  if (raw.speedWu === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.speedWu`);
  }
  if (raw.damage === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.damage`);
  }
  if (raw.bodyRadiusWu === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.bodyRadiusWu`);
  }
  if (raw.weight === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.weight`);
  }
  if (raw.challengeRating === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.challengeRating`);
  }
  if (!raw.combat) {
    throw new ConfigLoadError(`Expected object at ${path}.combat`);
  }
  const challengeRating = requireFiniteNumber(
    raw.challengeRating,
    `${path}.challengeRating`,
  );
  if (challengeRating < 0) {
    throw new ConfigLoadError(`Invalid number at ${path}.challengeRating`);
  }
  return {
    hp: requireFiniteNumber(raw.hp, `${path}.hp`),
    speedWu: requireFiniteNumber(raw.speedWu, `${path}.speedWu`),
    damage: requireFiniteNumber(raw.damage, `${path}.damage`),
    bodyRadiusWu: requireFiniteNumber(raw.bodyRadiusWu, `${path}.bodyRadiusWu`),
    weight: requireFiniteNumber(raw.weight, `${path}.weight`),
    challengeRating,
    behavior: raw.behavior,
    textureKey: raw.textureKey,
    displayName: raw.displayName?.trim() || titleCaseFromId(id),
    combat: raw.combat,
  };
}

function assertPositiveDamage(value: number, path: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConfigLoadError(`Missing or invalid number at ${path}`);
  }
}

/**
 * Verify behavior-specific combat
 * tables expose required damage fields (melee uses row `damage`).
 */
export function assertEnemyResolvedCombat(id: string, row: EnemyDef): void {
  const path = `enemies.${id}`;
  assertPositiveDamage(row.damage, `${path}.damage`);
  const resolved = resolveEnemyCombat(row.behavior, row.combat, id);
  if (MELEE_CHASE_STANDOFF_BEHAVIORS.has(row.behavior)) {
    assertPositiveDamage(row.damage, `${path}.damage (melee)`);
    const gap = row.combat?.melee?.meleeChaseStandoffWu;
    if (gap === undefined) {
      throw new ConfigLoadError(
        `Missing number at ${path}.combat.melee.meleeChaseStandoffWu`,
      );
    }
    if (!Number.isFinite(gap) || gap < 0) {
      throw new ConfigLoadError(
        `Invalid number at ${path}.combat.melee.meleeChaseStandoffWu`,
      );
    }
  }
  if (resolved.arrowRain) {
    assertPositiveDamage(resolved.arrowRain.damage, `${path}.combat.arrowRain.damage`);
  }
  if (resolved.javelineer) {
    assertPositiveDamage(resolved.javelineer.damage, `${path}.combat.javelineer.damage`);
  }
  if (resolved.stationaryRanged) {
    assertPositiveDamage(
      resolved.stationaryRanged.damage,
      `${path}.combat.stationaryRanged.damage`,
    );
  }
  if (resolved.lobber) {
    assertPositiveDamage(resolved.lobber.damage, `${path}.combat.lobber.damage`);
  }
  if (resolved.charger) {
    assertPositiveDamage(
      resolved.charger.chargeDamage,
      `${path}.combat.charger.chargeDamage`,
    );
  }
}