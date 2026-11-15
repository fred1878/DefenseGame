import type { EnemyInstance } from "../../entities/Enemy";
import { enemyIsAttacking } from "../../entities/EnemyCombat";

export function applyChaseVelocity(
  enemy: EnemyInstance,
  moveX: number,
  moveY: number,
  speedMul = 1,
): void {
  if (enemyIsAttacking(enemy.combat)) return;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const chaseScale = enemy.combat.phase === "active" ? 0.35 : 1;
  const speed = enemy.speed * speedMul * chaseScale;
  const angle = Math.atan2(moveY - ey, moveX - ex);
  enemy.sprite.setVelocity(
    Math.cos(angle) * speed,
    Math.sin(angle) * speed,
  );
}

export function applyDirectVelocity(
  enemy: EnemyInstance,
  dirX: number,
  dirY: number,
  speedMul = 1,
): void {
  if (enemyIsAttacking(enemy.combat)) return;
  const len = Math.hypot(dirX, dirY);
  if (len < 0.001) {
    enemy.sprite.setVelocity(0, 0);
    return;
  }
  const chaseScale = enemy.combat.phase === "active" ? 0.35 : 1;
  const speed = enemy.speed * speedMul * chaseScale;
  enemy.sprite.setVelocity((dirX / len) * speed, (dirY / len) * speed);
}