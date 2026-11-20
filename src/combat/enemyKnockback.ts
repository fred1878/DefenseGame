import type Phaser from "phaser";
import type { EnemyInstance } from "../entities/Enemy";

/** Exponential decay time constant for residual knockback slide. */
export const ENEMY_KNOCKBACK_DECAY_MS = 260;

export type EnemyKnockbackCarrier = Pick<
  EnemyInstance,
  "sprite" | "knockbackVx" | "knockbackVy"
>;

export function applyEnemyKnockbackFrom(
  enemy: EnemyKnockbackCarrier,
  fromX: number,
  fromY: number,
  strength: number,
): void {
  const dx = enemy.sprite.x - fromX;
  const dy = enemy.sprite.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  enemy.knockbackVx += nx * strength;
  enemy.knockbackVy += ny * strength;
  const maxV = strength * 1.35;
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