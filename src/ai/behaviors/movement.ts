import type { EnemyInstance } from "../../entities/Enemy";
import { WALL_VELOCITY_BLEND_MS } from "../../config";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import type { EnemyNavState } from "../EnemyBrain";

export type ChaseVelocityOptions = {
  nav?: EnemyNavState;
  deltaMs?: number;
};

function enemyMovementBlocked(enemy: EnemyInstance): boolean {
  if (enemy.behavior === "javelineer") return false;
  return enemyIsAttacking(enemy.combat);
}

export function applyChaseVelocity(
  enemy: EnemyInstance,
  moveX: number,
  moveY: number,
  speedMul = 1,
  opts?: ChaseVelocityOptions,
): void {
  if (enemyMovementBlocked(enemy)) return;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const chaseScale =
    enemy.behavior !== "javelineer" && enemy.combat.phase === "active" ? 0.35 : 1;
  const speed = enemy.speed * speedMul * chaseScale;
  const angle = Math.atan2(moveY - ey, moveX - ex);
  const desiredVx = Math.cos(angle) * speed;
  const desiredVy = Math.sin(angle) * speed;

  const nav = opts?.nav;
  const deltaMs = opts?.deltaMs ?? 0;
  const body = enemy.sprite.body as Phaser.Physics.Arcade.Body | null;
  if (nav && body && nav.wallTransitionMs > 0 && deltaMs > 0) {
    nav.wallTransitionMs = Math.max(0, nav.wallTransitionMs - deltaMs);
    const blend = Math.min(1, deltaMs / WALL_VELOCITY_BLEND_MS);
    const vx = body.velocity.x * (1 - blend) + desiredVx * blend;
    const vy = body.velocity.y * (1 - blend) + desiredVy * blend;
    enemy.sprite.setVelocity(vx, vy);
    return;
  }

  enemy.sprite.setVelocity(desiredVx, desiredVy);
}

export function applyDirectVelocity(
  enemy: EnemyInstance,
  dirX: number,
  dirY: number,
  speedMul = 1,
): void {
  if (enemyMovementBlocked(enemy)) return;
  const len = Math.hypot(dirX, dirY);
  if (len < 0.001) {
    enemy.sprite.setVelocity(0, 0);
    return;
  }
  const chaseScale =
    enemy.behavior !== "javelineer" && enemy.combat.phase === "active" ? 0.35 : 1;
  const speed = enemy.speed * speedMul * chaseScale;
  enemy.sprite.setVelocity((dirX / len) * speed, (dirY / len) * speed);
}