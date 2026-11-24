import type Phaser from "phaser";
import {
  DEFENSE_MAP,
  PLAYER_AGGRO_RADIUS,
  PLAYER_CHASE_MEMORY_MS,
  WALL_VELOCITY_BLEND_MS,
  northWallApproachY,
  northWallAttackY,
} from "../config";
import { worldUnit } from "../core/worldPixelScale";
import { findPath, type PathPoint } from "../pathfinding/astar";
import { hasLineOfSight } from "../pathfinding/los";
import type { NavGrid, NavPeerAgent } from "../pathfinding/grid";
import type { EnemyInstance } from "../entities/Enemy";
import {
  enemyPathClearancePx,
  playerPathClearancePx,
} from "../entities/entityPhysics";
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
  /** Accumulated ms while not gaining on the active path waypoint (physics stuck). */
  pathStallMs: number;
  /** Closest distance to the active waypoint since last replan / advance. */
  pathStallBestDist: number;
  /** Whether the last A* replan reached the goal cell (false = nearest-walkable fallback only). */
  pathGoalReached: boolean;
  /** Sticky pack/hold frame while the player cell is unreachable (small knockback ignored). */
  meleePackAnchorX?: number;
  meleePackAnchorY?: number;
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
    pathStallMs: 0,
    pathStallBestDist: Infinity,
    pathGoalReached: false,
  };
}

/** Force an early A* replan when arcade collision keeps the enemy from reaching waypoints. */
export function noteEnemyPathProgress(
  nav: EnemyNavState,
  ex: number,
  ey: number,
  deltaMs: number,
  waypointRadius: number,
  stallThresholdMs = DEFENSE_MAP.pathStallMs,
  minProgressPx = 3,
): void {
  if (nav.path.length === 0 || nav.pathIndex >= nav.path.length) {
    nav.pathStallMs = 0;
    nav.pathStallBestDist = Infinity;
    return;
  }
  const wp = nav.path[nav.pathIndex]!;
  const d = Math.hypot(wp.x - ex, wp.y - ey);
  if (d <= waypointRadius) {
    nav.pathStallMs = 0;
    nav.pathStallBestDist = Infinity;
    return;
  }
  if (d < nav.pathStallBestDist - minProgressPx) {
    nav.pathStallBestDist = d;
    nav.pathStallMs = 0;
    return;
  }
  nav.pathStallMs += deltaMs;
  if (nav.pathStallMs >= stallThresholdMs) {
    nav.replanMs = 0;
    nav.pathStallMs = 0;
    nav.pathStallBestDist = d;
  }
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
  registry?: Phaser.Data.DataManager,
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
  const wall = wallTargetPoint(ex, ey, registry);
  return { targetKind: "wall", goalX: wall.x, goalY: wall.y };
}

/** Movement / A* goal south of the wall plane. */
export function wallTargetPoint(
  ex: number,
  _ey: number,
  registry?: Phaser.Data.DataManager,
): { x: number; y: number } {
  return { x: ex, y: northWallApproachY(registry) };
}

/** Combat targeting plane on the wall (projectiles, swing arcs, range checks). */
export function wallCombatPoint(
  ex: number,
  registry?: Phaser.Data.DataManager,
): { x: number; y: number } {
  return { x: ex, y: northWallAttackY(registry) };
}

/** World-scaled player nav footprint while routing to the wall. */
export function wallPathingPlayerClearancePx(
  registry: Phaser.Data.DataManager | undefined,
): number {
  if (!registry) return playerPathClearancePx();
  return worldUnit(playerPathClearancePx(), registry);
}

/** Optional player position when routing to the wall so peers do not path through the hero. */
export function pathingPeerAgents(
  peerAgents: readonly NavPeerAgent[] | undefined,
  targetKind: EnemyTargetKind,
  playerX: number,
  playerY: number,
  playerClearancePx?: number,
): readonly NavPeerAgent[] {
  if (targetKind !== "wall") return peerAgents ?? [];
  return [
    ...(peerAgents ?? []),
    { x: playerX, y: playerY, clearancePx: playerClearancePx },
  ];
}

export function replanEnemyPath(
  nav: EnemyNavState,
  grid: NavGrid,
  ex: number,
  ey: number,
  goalX: number,
  goalY: number,
  waypointRadius: number = DEFENSE_MAP.pathWaypointRadius,
  peerAgents?: readonly NavPeerAgent[],
  enemy?: Pick<EnemyInstance, "defId" | "behavior" | "sprite">,
): void {
  const reg = enemy?.sprite.scene.registry;
  const agentClearancePx =
    enemy && reg
      ? worldUnit(enemyPathClearancePx(enemy.defId), reg)
      : grid.clearancePx;
  const { path, reachedGoal } = findPath(
    grid,
    ex,
    ey,
    goalX,
    goalY,
    peerAgents,
    agentClearancePx,
  );
  nav.path = path;
  nav.pathGoalReached = reachedGoal;
  nav.pathIndex = 0;
  nav.pathStallMs = 0;
  nav.pathStallBestDist = Infinity;
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
  peerAgents?: readonly NavPeerAgent[],
  peerAllies?: readonly EnemyPeerAlly[],
  objective: EnemyObjectiveMode = "defendWall",
): { targetX: number; targetY: number; targetKind: EnemyTargetKind } {
  const reg = enemy.sprite.scene.registry;
  noteEnemyPathProgress(
    nav,
    enemy.sprite.x,
    enemy.sprite.y,
    deltaMs,
    worldUnit(DEFENSE_MAP.pathWaypointRadius, reg),
    DEFENSE_MAP.pathStallMs,
    worldUnit(3, reg),
  );
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