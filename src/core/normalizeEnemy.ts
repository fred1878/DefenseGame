import {
  DEFAULT_ENEMY_BASE,
  type EnemyCombatPartial,
} from "./enemyTuning";
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
  return {
    hp: raw.hp ?? DEFAULT_ENEMY_BASE.hp,
    speed: raw.speed ?? DEFAULT_ENEMY_BASE.speed,
    damage: raw.damage ?? DEFAULT_ENEMY_BASE.damage,
    behavior: raw.behavior,
    textureKey: raw.textureKey,
    displayName: raw.displayName?.trim() || titleCaseFromId(id),
    ...(raw.combat ? { combat: raw.combat } : {}),
  };
}