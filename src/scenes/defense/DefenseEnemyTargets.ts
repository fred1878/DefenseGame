import type { EnemyInstance } from "../../entities/Enemy";
import { enemyCollisionBodyRadius } from "../../entities/entityPhysics";

/** An enemy as a combat target (spells, projectiles, bombs). */
export function defenseEnemyTarget(
  e: EnemyInstance,
  wu: (atDefault2x: number) => number,
) {
  return {
    id: e.id,
    x: e.sprite.x,
    y: e.sprite.y,
    radius: wu(enemyCollisionBodyRadius(e.defId)),
    damageable: e.damageable,
    sprite: e.sprite,
    enemy: e,
  };
}

export type EnemyTarget = ReturnType<typeof defenseEnemyTarget>;

/** Every living enemy as a combat target. */
export function defenseEnemyTargets(
  enemies: readonly EnemyInstance[],
  wu: (atDefault2x: number) => number,
): EnemyTarget[] {
  return enemies
    .filter((e) => e.damageable.alive)
    .map((e) => defenseEnemyTarget(e, wu));
}
