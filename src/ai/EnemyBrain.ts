import {
  DEFENSE_MAP,
  ENEMY_TUNING,
  PLAYER_AGGRO_RADIUS,
  westWallAttackX,
} from "../config";
import { findPath, type PathPoint } from "../pathfinding/astar";
import { hasLineOfSight } from "../pathfinding/los";
import type { NavGrid } from "../pathfinding/grid";
import type { EnemyInstance } from "../entities/Enemy";
import { enemyIsAttacking } from "../entities/EnemyCombat";

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

export function wallTargetPoint(_ex: number, ey: number): { x: number; y: number } {
  return { x: westWallAttackX(), y: ey };
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
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const desired = pickEnemyTarget(grid, ex, ey, playerX, playerY);
  nav.targetKind = desired;
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal =
    desired === "player"
      ? { x: playerX, y: playerY }
      : wallTargetPoint(ex, ey);

  if (nav.replanMs <= 0 || nav.path.length === 0) {
    replanEnemyPath(nav, grid, ex, ey, goal.x, goal.y);
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  let moveX = goal.x;
  let moveY = goal.y;

  if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
    const wp = nav.path[nav.pathIndex]!;
    const d = Math.hypot(wp.x - ex, wp.y - ey);
    if (d <= DEFENSE_MAP.pathWaypointRadius) {
      nav.pathIndex += 1;
    }
    const nextWp = nav.path[nav.pathIndex];
    if (nextWp) {
      moveX = nextWp.x;
      moveY = nextWp.y;
    }
  }

  if (!enemyIsAttacking(enemy.combat)) {
    const speed = ENEMY_TUNING.gruntSpeed;
    const chaseScale = enemy.combat.phase === "active" ? 0.4 : 1;
    const angle = Math.atan2(moveY - ey, moveX - ex);
    enemy.sprite.setVelocity(
      Math.cos(angle) * speed * chaseScale,
      Math.sin(angle) * speed * chaseScale,
    );
  }

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
}