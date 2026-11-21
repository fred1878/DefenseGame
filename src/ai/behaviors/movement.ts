import type { EnemyInstance } from "../../entities/Enemy";
import { WALL_VELOCITY_BLEND_MS, northWallAttackY } from "../../config";
import { setEnemyChaseVelocity } from "../../combat/enemyKnockback";
import { requireMeleeChaseStandoffWu, wallMeleeApproachStandoffPx } from "../../core/enemyTuning";
import { worldUnit } from "../../core/worldPixelScale";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import {
  enemyCollisionBodyRadius,
  isMeleeBodyCollisionBehavior,
  playerBodyRadiusPx,
} from "../../entities/entityPhysics";
import type { EnemyNavState, EnemyTargetKind } from "../EnemyBrain";

export { setEnemyChaseVelocity };

export type ChaseVelocityOptions = {
  nav?: EnemyNavState;
  deltaMs?: number;
  targetKind?: EnemyTargetKind;
  /** Live player position — used for melee standoff while chasing the player. */
  playerX?: number;
  playerY?: number;
};

/** Center distance at which melee archetypes stop closing on the player. */
export function playerMeleeChaseStandoffCenterDist(
  enemy: EnemyInstance,
): number {
  const reg = enemy.sprite.scene?.registry;
  const gapWu = requireMeleeChaseStandoffWu(
    enemy.combatTuning.melee,
    enemy.behavior,
    enemy.defId,
  );
  return (
    worldUnit(playerBodyRadiusPx(), reg) +
    worldUnit(enemyCollisionBodyRadius(enemy.defId), reg) +
    worldUnit(gapWu, reg)
  );
}

export function shouldHoldAtPlayerMelee(
  enemy: EnemyInstance,
  targetKind: EnemyTargetKind,
  playerX: number,
  playerY: number,
): boolean {
  if (targetKind !== "player") return false;
  if (!isMeleeBodyCollisionBehavior(enemy.behavior)) return false;
  const dist = Math.hypot(
    playerX - enemy.sprite.x,
    playerY - enemy.sprite.y,
  );
  return dist <= playerMeleeChaseStandoffCenterDist(enemy);
}

export function applyPlayerMeleeHold(enemy: EnemyInstance): void {
  setEnemyChaseVelocity(enemy, 0, 0);
}

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
  const dist = wallMeleeDistToAttackPlane(enemy);
  if (dist > wall.triggerRange) return false;
  if (enemyIsAttacking(enemy.combat)) return true;
  if (dist > wall.hitRange) return false;
  return enemy.combat.phase === "idle";
}

export function wallMeleeStandoffY(enemy: EnemyInstance): number {
  const standoff = wallMeleeApproachStandoffPx(enemy.combatTuning.wall);
  return northWallAttackY() + standoff;
}

export function applyWallMeleeHold(enemy: EnemyInstance): void {
  setEnemyChaseVelocity(enemy, 0, 0);
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
  if (
    opts?.targetKind &&
    opts.playerX !== undefined &&
    opts.playerY !== undefined &&
    shouldHoldAtPlayerMelee(enemy, opts.targetKind, opts.playerX, opts.playerY)
  ) {
    applyPlayerMeleeHold(enemy);
    return;
  }
  if (enemyMovementBlocked(enemy)) {
    setEnemyChaseVelocity(enemy, 0, 0);
    return;
  }
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
    const chaseVx = body.velocity.x - enemy.knockbackVx;
    const chaseVy = body.velocity.y - enemy.knockbackVy;
    const vx = chaseVx * (1 - blend) + desiredVx * blend;
    const vy = chaseVy * (1 - blend) + desiredVy * blend;
    setEnemyChaseVelocity(enemy, vx, vy);
    return;
  }

  setEnemyChaseVelocity(enemy, desiredVx, desiredVy);
}

export function applyDirectVelocity(
  enemy: EnemyInstance,
  dirX: number,
  dirY: number,
  speedMul = 1,
): void {
  if (enemyMovementBlocked(enemy)) {
    setEnemyChaseVelocity(enemy, 0, 0);
    return;
  }
  const len = Math.hypot(dirX, dirY);
  if (len < 0.001) {
    setEnemyChaseVelocity(enemy, 0, 0);
    return;
  }
  const chaseScale = chasePhaseScale(enemy);
  const statusMul = enemy.statusSpeedMul ?? 1;
  const speed = enemy.speed * speedMul * chaseScale * statusMul;
  setEnemyChaseVelocity(
    enemy,
    (dirX / len) * speed,
    (dirY / len) * speed,
  );
}