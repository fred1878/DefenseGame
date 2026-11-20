import type { EnemyInstance } from "../entities/Enemy";

/** Exponential decay for residual knockback slide (world-ms). */
export const ENEMY_KNOCKBACK_DECAY_MS = 260;

/** Config baseline: knockback impulse scales as `strength * (baseline / weight)`. */
export const ENEMY_KNOCKBACK_WEIGHT_BASELINE = 100;

export type EnemyKnockbackCarrier = Pick<
  EnemyInstance,
  "sprite" | "knockbackVx" | "knockbackVy" | "weight"
>;

export function knockbackStrengthForEnemyWeight(
  strength: number,
  weight: number,
): number {
  if (weight <= 0 || !Number.isFinite(weight)) {
    return 0;
  }
  return strength * (ENEMY_KNOCKBACK_WEIGHT_BASELINE / weight);
}

export function applyEnemyKnockbackFrom(
  enemy: EnemyKnockbackCarrier,
  fromX: number,
  fromY: number,
  strength: number,
): void {
  const scaled = knockbackStrengthForEnemyWeight(strength, enemy.weight);
  const dx = enemy.sprite.x - fromX;
  const dy = enemy.sprite.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  enemy.knockbackVx += nx * scaled;
  enemy.knockbackVy += ny * scaled;
  const maxV = scaled * 1.35;
  const vlen = Math.hypot(enemy.knockbackVx, enemy.knockbackVy);
  if (vlen > maxV) {
    enemy.knockbackVx = (enemy.knockbackVx / vlen) * maxV;
    enemy.knockbackVy = (enemy.knockbackVy / vlen) * maxV;
  }
}

export function decayEnemyKnockback(
  enemy: EnemyKnockbackCarrier,
  deltaMs: number,
): void {
  if (deltaMs <= 0) return;
  const factor = Math.exp(-deltaMs / ENEMY_KNOCKBACK_DECAY_MS);
  enemy.knockbackVx *= factor;
  enemy.knockbackVy *= factor;
  if (Math.hypot(enemy.knockbackVx, enemy.knockbackVy) < 2) {
    enemy.knockbackVx = 0;
    enemy.knockbackVy = 0;
  }
}

export function setEnemyChaseVelocity(
  enemy: EnemyKnockbackCarrier,
  chaseVx: number,
  chaseVy: number,
): void {
  enemy.sprite.setVelocity(
    chaseVx + enemy.knockbackVx,
    chaseVy + enemy.knockbackVy,
  );
}