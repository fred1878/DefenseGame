import { tuning } from "../../tuning/gameTuning";
import type { EnemyInstance } from "../../entities/Enemy";
import { knockbackVelocityCapMult } from "../../entities/entityPhysics";

export type EnemyKnockbackCarrier = Pick<
  EnemyInstance,
  "sprite" | "knockbackVx" | "knockbackVy" | "weight"
>;

const BLAST_CENTER_EPSILON_PX = 0.5;

/** Radial outward unit vector from blast/hit origin to target (stable fallback at origin). */
export function knockbackRadialUnit(
  targetX: number,
  targetY: number,
  originX: number,
  originY: number,
): { nx: number; ny: number } {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const len = Math.hypot(dx, dy);
  if (len >= BLAST_CENTER_EPSILON_PX) {
    return { nx: dx / len, ny: dy / len };
  }
  const hash = Math.sin(targetX * 12.9898 + targetY * 78.233) * 43758.5453;
  const angle = (hash - Math.floor(hash)) * Math.PI * 2;
  return { nx: Math.cos(angle), ny: Math.sin(angle) };
}

export function knockbackStrengthForEnemyWeight(
  strength: number,
  weight: number,
): number {
  if (weight <= 0 || !Number.isFinite(weight)) {
    return 0;
  }
  // Impulse scales as `strength * (baseline / weight)` (`gameplay.json` combat).
  return (
    strength * (tuning("gameplay").combat.knockbackWeightBaseline / weight)
  );
}

export function applyEnemyKnockbackFrom(
  enemy: EnemyKnockbackCarrier,
  fromX: number,
  fromY: number,
  strength: number,
): void {
  const scaled = knockbackStrengthForEnemyWeight(strength, enemy.weight);
  const { nx, ny } = knockbackRadialUnit(
    enemy.sprite.x,
    enemy.sprite.y,
    fromX,
    fromY,
  );
  enemy.knockbackVx += nx * scaled;
  enemy.knockbackVy += ny * scaled;
  const maxV = scaled * knockbackVelocityCapMult();
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
  const factor = Math.exp(
    -deltaMs / tuning("gameplay").combat.enemyKnockbackDecayMs,
  );
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
