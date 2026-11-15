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
  combat?: EnemyCombatPartial;
};

export function normalizeEnemyRow(_id: string, raw: EnemyDefInput): EnemyDef {
  return {
    hp: raw.hp ?? DEFAULT_ENEMY_BASE.hp,
    speed: raw.speed ?? DEFAULT_ENEMY_BASE.speed,
    damage: raw.damage ?? DEFAULT_ENEMY_BASE.damage,
    behavior: raw.behavior,
    textureKey: raw.textureKey,
    ...(raw.combat ? { combat: raw.combat } : {}),
  };
}