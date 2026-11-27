import { DEFENSE_MAP } from "../../../config";
import {
  type EnemyNavState,
  type EnemyTargetKind,
  pathingPeerAgents,
  replanEnemyPath,
  wallPathingPlayerClearancePx,
} from "../../brainShared";
import { applyChaseVelocity, playerChaseVelocityOpts } from "../movement";
import type { EnemyBehaviorContext } from "../types";

/**
 * Shared path-approach steps used by the wall-approach behaviours (charger,
 * wallSiege, ward) and the ranged kite path follower.
 */

/** Replan toward `goal` when the replan timer ran out or there is no path. */
export function replanApproachPathIfDue(
  ctx: EnemyBehaviorContext,
  ex: number,
  ey: number,
  goalX: number,
  goalY: number,
  targetKind: EnemyTargetKind,
  waypointRadius: number,
): void {
  const { enemy, nav } = ctx;
  if (nav.replanMs > 0 && nav.path.length > 0) return;
  replanEnemyPath(
    nav,
    ctx.grid,
    ex,
    ey,
    goalX,
    goalY,
    waypointRadius,
    pathingPeerAgents(
      ctx.peerAgents,
      targetKind,
      ctx.playerX,
      ctx.playerY,
      wallPathingPlayerClearancePx(enemy.sprite.scene.registry),
    ),
    enemy,
  );
  nav.replanMs = DEFENSE_MAP.pathReplanMs;
}

/**
 * Advance past a reached waypoint and return the point to steer at: the next
 * waypoint, or the goal when the path is empty or finished.
 */
export function nextPathMoveTarget(
  nav: EnemyNavState,
  ex: number,
  ey: number,
  goalX: number,
  goalY: number,
  waypointRadius: number,
): { x: number; y: number } {
  let x = goalX;
  let y = goalY;
  if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
    const wp = nav.path[nav.pathIndex]!;
    if (Math.hypot(wp.x - ex, wp.y - ey) <= waypointRadius) {
      nav.pathIndex += 1;
    }
    const nextWp = nav.path[nav.pathIndex];
    if (nextWp) {
      x = nextWp.x;
      y = nextWp.y;
    }
  }
  return { x, y };
}

/** Chase velocity toward `move` with the standard player-chase options. */
export function chaseToward(
  ctx: EnemyBehaviorContext,
  move: { x: number; y: number },
  speedMul: number,
  targetKind: EnemyTargetKind,
): void {
  const { enemy, nav } = ctx;
  applyChaseVelocity(
    enemy,
    move.x,
    move.y,
    speedMul,
    playerChaseVelocityOpts(enemy, {
      nav,
      deltaMs: ctx.deltaMs,
      targetKind,
      playerX: ctx.playerX,
      playerY: ctx.playerY,
      peerAllies: ctx.peerAllies,
    }),
  );
}
