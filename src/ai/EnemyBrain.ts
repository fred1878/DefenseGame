import {
  DEFENSE_MAP,
  PLAYER_AGGRO_RADIUS,
  PLAYER_CHASE_MEMORY_MS,
  WALL_VELOCITY_BLEND_MS,
  northWallApproachY,
  northWallAttackY,
} from "../config";
import { findPath, type PathPoint } from "../pathfinding/astar";
import { hasLineOfSight } from "../pathfinding/los";
import type { NavGrid } from "../pathfinding/grid";
import type { EnemyInstance } from "../entities/Enemy";
import { getEnemyBehavior } from "./behaviors";
import type { EnemyPeerAlly } from "./behaviors/types";

export type EnemyTargetKind = "wall" | "player";

/** Night defense protects the wall; endless training hunts the player only. */
export type EnemyObjectiveMode = "defendWall" | "huntPlayer";

export type EnemyNavState = {
  targetKind: EnemyTargetKind;
  path: PathPoint[];
  pathIndex: number;
  replanMs: number;
  lastKnownPlayerX: number;
  lastKnownPlayerY: number;
  chaseMemoryMs: number;
  wallTransitionMs: number;
};

export type EnemyTargetResolution = {
  targetKind: EnemyTargetKind;
  goalX: number;
  goalY: number;
};

export function createEnemyNav(): EnemyNavState {
  return {
    targetKind: "wall",
    path: [],
    pathIndex: 0,
    replanMs: 0,
    lastKnownPlayerX: 0,
    lastKnownPlayerY: 0,
    chaseMemoryMs: 0,
    wallTransitionMs: 0,
  };
}

/** Instantaneous aggro check (LOS + radius); does not apply chase memory. */
export function pickEnemyTarget(
  grid: NavGrid,
  ex: number,
  ey: number,
  px: number,
  py: number,
  aggroRadius: number = PLAYER_AGGRO_RADIUS,
  objective: EnemyObjectiveMode = "defendWall",
): EnemyTargetKind {
  if (objective === "huntPlayer") {
    return "player";
  }
  if (hasLivePlayerAggro(grid, ex, ey, px, py, aggroRadius)) {
    return "player";
  }
  return "wall";
}

/** Combat swings/projectiles: live aggro only (not chase-memory movement targets). */
export const pickEnemyCombatTarget = pickEnemyTarget;

function hasLivePlayerAggro(
  grid: NavGrid,
  ex: number,
  ey: number,
  px: number,
  py: number,
  aggroRadius: number = PLAYER_AGGRO_RADIUS,
): boolean {
  const dist = Math.hypot(px - ex, py - ey);
  return dist <= aggroRadius && hasLineOfSight(grid, ex, ey, px, py);
}

/** Target resolution with chase memory and wall-abandon transition flags on nav. */
export function resolveEnemyTarget(
  nav: EnemyNavState,
  grid: NavGrid,
  ex: number,
  ey: number,
  px: number,
  py: number,
  deltaMs: number,
  aggroRadius: number = PLAYER_AGGRO_RADIUS,
  objective: EnemyObjectiveMode = "defendWall",
): EnemyTargetResolution {
  if (objective === "huntPlayer") {
    nav.lastKnownPlayerX = px;
    nav.lastKnownPlayerY = py;
    nav.chaseMemoryMs = PLAYER_CHASE_MEMORY_MS;
    nav.targetKind = "player";
    nav.wallTransitionMs = 0;
    return { targetKind: "player", goalX: px, goalY: py };
  }
  if (hasLivePlayerAggro(grid, ex, ey, px, py, aggroRadius)) {
    nav.lastKnownPlayerX = px;
    nav.lastKnownPlayerY = py;
    nav.chaseMemoryMs = PLAYER_CHASE_MEMORY_MS;
    nav.targetKind = "player";
    nav.wallTransitionMs = 0;
    return { targetKind: "player", goalX: px, goalY: py };
  }

  if (nav.chaseMemoryMs > 0) {
    nav.chaseMemoryMs = Math.max(0, nav.chaseMemoryMs - deltaMs);
    if (nav.chaseMemoryMs > 0) {
      nav.targetKind = "player";
      return {
        targetKind: "player",
        goalX: nav.lastKnownPlayerX,
        goalY: nav.lastKnownPlayerY,
      };
    }
  }

  const wasChasingPlayer = nav.targetKind === "player";
  nav.targetKind = "wall";
  if (wasChasingPlayer) {
    nav.wallTransitionMs = WALL_VELOCITY_BLEND_MS;
  }
  const wall = wallTargetPoint(ex, ey);
  return { targetKind: "wall", goalX: wall.x, goalY: wall.y };
}

/** Movement / A* goal south of the wall plane. */
export function wallTargetPoint(ex: number, _ey: number): { x: number; y: number } {
  return { x: ex, y: northWallApproachY() };
}

/** Combat targeting plane on the wall (projectiles, swing arcs, range checks). */
export function wallCombatPoint(ex: number): { x: number; y: number } {
  return { x: ex, y: northWallAttackY() };
}

export function replanEnemyPath(
  nav: EnemyNavState,
  grid: NavGrid,
  ex: number,
  ey: number,
  goalX: number,
  goalY: number,
  waypointRadius: number = DEFENSE_MAP.pathWaypointRadius,
  peerAgents?: readonly { x: number; y: number }[],
): void {
  const path = findPath(grid, ex, ey, goalX, goalY, peerAgents);
  nav.path = path;
  nav.pathIndex = 0;
  const first = path[0];
  if (first && Math.hypot(first.x - ex, first.y - ey) < waypointRadius) {
    nav.pathIndex = 1;
  }
}

export function updateEnemyBrain(
  enemy: EnemyInstance,
  nav: EnemyNavState,
  grid: NavGrid,
  playerX: number,
  playerY: number,
  deltaMs: number,
  peerAgents?: readonly { x: number; y: number }[],
  peerAllies?: readonly EnemyPeerAlly[],
  objective: EnemyObjectiveMode = "defendWall",
): { targetX: number; targetY: number; targetKind: EnemyTargetKind } {
  const behavior = getEnemyBehavior(enemy.behavior);
  return behavior({
    enemy,
    nav,
    grid,
    playerX,
    playerY,
    deltaMs,
    peerAgents,
    peerAllies,
    objective,
  });
}