import { ConfigLoadError, requireFiniteNumber } from "./configValidation";
import { resolveEnemyCombat, type EnemyCombatPartial } from "./enemyTuning";
import type { EnemyDef } from "./DataStore";

export type EnemyDefInput = {
  hp?: number;
  speed?: number;
  damage?: number;
  weight?: number;
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
  if (raw.speed === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.speed`);
  }
  if (raw.damage === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.damage`);
  }
  if (raw.weight === undefined) {
    throw new ConfigLoadError(`Missing number at ${path}.weight`);
  }
  return {
    hp: requireFiniteNumber(raw.hp, `${path}.hp`),
    speed: requireFiniteNumber(raw.speed, `${path}.speed`),
    damage: requireFiniteNumber(raw.damage, `${path}.damage`),
    weight: requireFiniteNumber(raw.weight, `${path}.weight`),
    behavior: raw.behavior,
    textureKey: raw.textureKey,
    displayName: raw.displayName?.trim() || titleCaseFromId(id),
    ...(raw.combat ? { combat: raw.combat } : {}),
  };
}

function assertPositiveDamage(value: number, path: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConfigLoadError(`Missing or invalid number at ${path}`);
  }
}

/**
 * After `enemy-combat-defaults.json` is applied, verify behavior-specific combat
 * tables expose required damage fields (melee uses row `damage`).
 */
export function assertEnemyResolvedCombat(id: string, row: EnemyDef): void {
  const path = `enemies.${id}`;
  assertPositiveDamage(row.damage, `${path}.damage`);
  const resolved = resolveEnemyCombat(row.behavior, row.combat, id);
  const meleeBehaviors = new Set([
    "meleeChaser",
    "bruiser",
    "wallSiege",
    "ward",
    "charger",
  ]);
  if (meleeBehaviors.has(row.behavior) || resolved.melee) {
    assertPositiveDamage(row.damage, `${path}.damage (melee)`);
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