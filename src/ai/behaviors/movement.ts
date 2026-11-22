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

/** World units — ignore player nudge smaller than this for pack holds / chord tests. */
const MELEE_PACK_ANCHOR_HYSTERESIS_WU = 4;
import type { EnemyPeerAlly } from "./types";

export { setEnemyChaseVelocity };

export type MeleeChasePeer = {
  x: number;
  y: number;
  defId: string;
};

export type ChaseVelocityOptions = {
  nav?: EnemyNavState;
  deltaMs?: number;
  targetKind?: EnemyTargetKind;
  /** Live player position — used for melee standoff while chasing the player. */
  playerX?: number;
  playerY?: number;
  /** Live ally positions for peer chord blocking on direct player closes. */
  meleeChasePeers?: readonly MeleeChasePeer[];
};

export function meleeChasePeersFromAllies(
  selfId: string,
  peerAllies?: readonly EnemyPeerAlly[],
): readonly MeleeChasePeer[] | undefined {
  if (!peerAllies?.length) return undefined;
  return peerAllies
    .filter((p) => p.id !== selfId)
    .map((p) => ({ x: p.x, y: p.y, defId: p.defId }));
}

export function playerChaseVelocityOpts(
  enemy: EnemyInstance,
  params: {
    nav?: EnemyNavState;
    deltaMs?: number;
    targetKind: EnemyTargetKind;
    playerX: number;
    playerY: number;
    peerAllies?: readonly EnemyPeerAlly[];
  },
): ChaseVelocityOptions {
  return {
    nav: params.nav,
    deltaMs: params.deltaMs,
    targetKind: params.targetKind,
    playerX: params.playerX,
    playerY: params.playerY,
    meleeChasePeers: meleeChasePeersFromAllies(enemy.id, params.peerAllies),
  };
}

/** Center distance at which melee archetypes stop closing on the player. */
export function playerMeleeChaseStandoffCenterDist(
  enemy: EnemyInstance,
): number {
  const reg = enemy.sprite.scene?.registry;
  const melee = enemy.combatTuning.melee;
  if (!melee) {
    throw new Error(
      `playerMeleeChaseStandoffCenterDist requires combat.melee for ${enemy.behavior}`,
    );
  }
  const gapWu = requireMeleeChaseStandoffWu(
    melee,
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

/** Hold point on the line to the player at melee chase standoff (player center frame). */
export function playerMeleeChaseHoldPoint(
  enemy: EnemyInstance,
  playerX: number,
  playerY: number,
): { x: number; y: number } {
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const dx = ex - playerX;
  const dy = ey - playerY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return { x: ex, y: ey };
  }
  const holdDist = playerMeleeChaseStandoffCenterDist(enemy);
  return {
    x: playerX + (dx / len) * holdDist,
    y: playerY + (dy / len) * holdDist,
  };
}

function distSqPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return (px - x1) ** 2 + (py - y1) ** 2;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

function circleBlocksSegment(
  cx: number,
  cy: number,
  radius: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  return distSqPointToSegment(cx, cy, x1, y1, x2, y2) <= radius * radius;
}

function isClosingOnPlayer(
  ex: number,
  ey: number,
  moveX: number,
  moveY: number,
  playerX: number,
  playerY: number,
): boolean {
  const toPlayerX = playerX - ex;
  const toPlayerY = playerY - ey;
  const toMoveX = moveX - ex;
  const toMoveY = moveY - ey;
  return toPlayerX * toMoveX + toPlayerY * toMoveY > 0;
}

function isDirectPlayerChaseMove(
  moveX: number,
  moveY: number,
  playerX: number,
  playerY: number,
): boolean {
  return Math.hypot(moveX - playerX, moveY - playerY) < 1;
}

/** True when melee may cut from A* to a LOS line-of-march toward the player (not mid-flank). */
export function shouldMeleeLosShortcutToPlayer(
  _enemy: EnemyInstance,
  nav: EnemyNavState,
  _playerX: number,
  _playerY: number,
): boolean {
  if (!nav.pathGoalReached) return false;
  return nav.path.length === 0 || nav.pathIndex >= nav.path.length;
}

/** Keep unreachable player goals sticky until standoff engage (avoids knockback LOS resync). */
export function commitPlayerChasePathGoal(
  nav: EnemyNavState,
  reachedGoal: boolean,
  wasReachable: boolean,
  inStandoff: boolean,
): void {
  if (!reachedGoal) {
    nav.pathGoalReached = false;
    return;
  }
  if (!wasReachable) {
    nav.pathGoalReached = inStandoff;
    return;
  }
  nav.pathGoalReached = true;
}

/**
 * Player position for pack chord/hold math — anchors while unreachable or chord-blocked
 * so micro knockback does not re-open LOS closes for the whole ring.
 */
export function meleePackPlayerAnchor(
  nav: EnemyNavState,
  playerX: number,
  playerY: number,
  anchorActive: boolean,
  hysteresisPx: number,
): { x: number; y: number } {
  if (!anchorActive) {
    nav.meleePackAnchorX = undefined;
    nav.meleePackAnchorY = undefined;
    return { x: playerX, y: playerY };
  }
  if (nav.meleePackAnchorX === undefined || nav.meleePackAnchorY === undefined) {
    nav.meleePackAnchorX = playerX;
    nav.meleePackAnchorY = playerY;
    return { x: playerX, y: playerY };
  }
  const d = Math.hypot(
    playerX - nav.meleePackAnchorX,
    playerY - nav.meleePackAnchorY,
  );
  if (d > hysteresisPx) {
    nav.meleePackAnchorX = playerX;
    nav.meleePackAnchorY = playerY;
  }
  return { x: nav.meleePackAnchorX, y: nav.meleePackAnchorY };
}

export function meleePackAnchorHysteresisPx(
  registry: Phaser.Data.DataManager,
): number {
  return worldUnit(MELEE_PACK_ANCHOR_HYSTERESIS_WU, registry);
}

/** True when a closer ally's body blocks the direct close line toward the player. */
export function shouldHoldMeleeChaseChordBlocked(
  enemy: EnemyInstance,
  playerX: number,
  playerY: number,
  peers?: readonly MeleeChasePeer[],
): boolean {
  if (!peers?.length || !isMeleeBodyCollisionBehavior(enemy.behavior)) {
    return false;
  }
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const distSelf = Math.hypot(playerX - ex, playerY - ey);
  const hold = playerMeleeChaseHoldPoint(enemy, playerX, playerY);
  const reg = enemy.sprite.scene?.registry;
  const selfR = worldUnit(enemyCollisionBodyRadius(enemy.defId), reg);

  for (const peer of peers) {
    const distPeer = Math.hypot(playerX - peer.x, playerY - peer.y);
    if (distPeer >= distSelf) continue;
    const peerR = worldUnit(enemyCollisionBodyRadius(peer.defId), reg);
    const occupyR = selfR + peerR;
    if (
      circleBlocksSegment(peer.x, peer.y, occupyR, ex, ey, playerX, playerY) ||
      circleBlocksSegment(peer.x, peer.y, occupyR, ex, ey, hold.x, hold.y)
    ) {
      return true;
    }
  }
  return false;
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
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  if (
    opts?.targetKind &&
    opts.playerX !== undefined &&
    opts.playerY !== undefined &&
    shouldHoldAtPlayerMelee(enemy, opts.targetKind, opts.playerX, opts.playerY)
  ) {
    applyPlayerMeleeHold(enemy);
    return;
  }
  if (
    opts?.targetKind === "player" &&
    opts.playerX !== undefined &&
    opts.playerY !== undefined &&
    isDirectPlayerChaseMove(moveX, moveY, opts.playerX, opts.playerY) &&
    isClosingOnPlayer(ex, ey, moveX, moveY, opts.playerX, opts.playerY) &&
    shouldHoldMeleeChaseChordBlocked(
      enemy,
      opts.playerX,
      opts.playerY,
      opts.meleeChasePeers,
    )
  ) {
    applyPlayerMeleeHold(enemy);
    return;
  }
  if (enemyMovementBlocked(enemy)) {
    setEnemyChaseVelocity(enemy, 0, 0);
    return;
  }
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