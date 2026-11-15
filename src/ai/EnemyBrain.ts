import {
  DEFENSE_MAP,
  PLAYER_AGGRO_RADIUS,
  northWallAttackY,
} from "../config";
import { findPath, type PathPoint } from "../pathfinding/astar";
import { hasLineOfSight } from "../pathfinding/los";
import type { NavGrid } from "../pathfinding/grid";
import type { EnemyInstance } from "../entities/Enemy";
import { getEnemyBehavior } from "./behaviors";

export type EnemyTargetKind = "wall" | "player";

export type EnemyNavState = {
  targetKind: EnemyTargetKind;
  path: PathPoint[];
  pathIndex: number;
  replanMs: number;
};

export function createEnemyNav(): EnemyNavState {
  return {
    targetKind: "wall",
    path: [],
    pathIndex: 0,
    replanMs: 0,
  };
}

export function pickEnemyTarget(
  grid: NavGrid,
  ex: number,
  ey: number,
  px: number,
  py: number,
): EnemyTargetKind {
  const dist = Math.hypot(px - ex, py - ey);
  if (dist <= PLAYER_AGGRO_RADIUS && hasLineOfSight(grid, ex, ey, px, py)) {
    return "player";
  }
  return "wall";
}

export function wallTargetPoint(ex: number, _ey: number): { x: number; y: number } {
  return { x: ex, y: northWallAttackY() };
}

export function replanEnemyPath(
  nav: EnemyNavState,
  grid: NavGrid,
  ex: number,
  ey: number,
  goalX: number,
  goalY: number,
): void {
  const path = findPath(grid, ex, ey, goalX, goalY);
  nav.path = path;
  nav.pathIndex = 0;
  const first = path[0];
  if (first && Math.hypot(first.x - ex, first.y - ey) < DEFENSE_MAP.pathWaypointRadius) {
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
): { targetX: number; targetY: number; targetKind: EnemyTargetKind } {
  const behavior = getEnemyBehavior(enemy.behavior);
  return behavior({
    enemy,
    nav,
    grid,
    playerX,
    playerY,
    deltaMs,
  });
}