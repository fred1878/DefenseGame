import type { EnemyInstance } from "../../entities/Enemy";
import { WALL_VELOCITY_BLEND_MS, northWallAttackY } from "../../config";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import type { EnemyNavState, EnemyTargetKind } from "../EnemyBrain";

export type ChaseVelocityOptions = {
  nav?: EnemyNavState;
  deltaMs?: number;
  targetKind?: EnemyTargetKind;
};

/** Distance to the north-wall swing plane (same x as the enemy). */
export function wallMeleeDistToAttackPlane(enemy: EnemyInstance): number {
  return Math.abs(enemy.sprite.y - northWallAttackY());
}

/** Hold at the wall standoff while in range but not free to close (cooldown / swing). */
export function shouldHoldAtWallMelee(
  enemy: EnemyInstance,
  targetKind: EnemyTargetKind,
): boolean {
  if (targetKind !== "wall") return false;
  const { wall } = enemy.combatTuning;
  if (wallMeleeDistToAttackPlane(enemy) > wall.triggerRange) return false;
  if (enemyIsAttacking(enemy.combat)) return true;
  return enemy.combat.phase === "idle";
}

export function wallMeleeStandoffY(enemy: EnemyInstance): number {
  const standoff = Math.max(0, enemy.combatTuning.wall.triggerRange - 6);
  return northWallAttackY() + standoff;
}

export function applyWallMeleeHold(enemy: EnemyInstance): void {
  enemy.sprite.setVelocity(0, 0);
  const approachY = wallMeleeStandoffY(enemy);
  if (enemy.sprite.y < approachY + 1) {
    enemy.sprite.y = approachY;
  }
}

const BRUISER_ATTACK_MOVE_MUL = 0.5;

function enemyMovementBlocked(enemy: EnemyInstance): boolean {
  if (enemy.behavior === "javelineer" || enemy.behavior === "bruiser") {
    return false;
  }
  return enemyIsAttacking(enemy.combat);
}

function chasePhaseScale(enemy: EnemyInstance): number {
  if (enemy.behavior === "javelineer") return 1;
  if (enemy.behavior === "bruiser" && enemyIsAttacking(enemy.combat)) {
    return BRUISER_ATTACK_MOVE_MUL;
  }
  if (enemy.combat.phase === "active") return 0.35;
  return 1;
}

export function applyChaseVelocity(
  enemy: EnemyInstance,
  moveX: number,
  moveY: number,
  speedMul = 1,
  opts?: ChaseVelocityOptions,
): void {
  if (
    opts?.targetKind &&
    shouldHoldAtWallMelee(enemy, opts.targetKind)
  ) {
    applyWallMeleeHold(enemy);
    return;
  }
  if (enemyMovementBlocked(enemy)) return;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const chaseScale = chasePhaseScale(enemy);
  const statusMul = enemy.statusSpeedMul ?? 1;
  const speed = enemy.speed * speedMul * chaseScale * statusMul;
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
  const chaseScale = chasePhaseScale(enemy);
  const statusMul = enemy.statusSpeedMul ?? 1;
  const speed = enemy.speed * speedMul * chaseScale * statusMul;
  enemy.sprite.setVelocity((dirX / len) * speed, (dirY / len) * speed);
}