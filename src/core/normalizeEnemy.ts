import { ConfigLoadError, requireFiniteNumber } from "./configValidation";
import type { EnemyCombatPartial } from "./enemyTuning";
import type { EnemyDef } from "./DataStore";

export type EnemyDefInput = {
  hp?: number;
  speed?: number;
  damage?: number;
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
  return {
    hp: requireFiniteNumber(raw.hp, `${path}.hp`),
    speed: requireFiniteNumber(raw.speed, `${path}.speed`),
    damage: requireFiniteNumber(raw.damage, `${path}.damage`),
    behavior: raw.behavior,
    textureKey: raw.textureKey,
    displayName: raw.displayName?.trim() || titleCaseFromId(id),
    ...(raw.combat ? { combat: raw.combat } : {}),
  };
}