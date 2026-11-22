import { DEFENSE_MAP } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import {
  clampToDefensePlayBounds,
  defensePlayBoundsInset,
  enemyCollisionBodyRadius,
  enemyPathClearancePx,
} from "../../entities/entityPhysics";
import type { EnemyInstance } from "../../entities/Enemy";
import type { NavGrid, NavPeerAgent } from "../../pathfinding/grid";
import {
  cellBlocked,
  cellToWorldCenter,
  nearestWalkable,
  worldToCell,
} from "../../pathfinding/grid";
import type { EnemyNavState } from "../EnemyBrain";
import { replanEnemyPath } from "../EnemyBrain";
import {
  applyChaseVelocity,
  applyDirectVelocity,
  type ChaseVelocityOptions,
  setEnemyChaseVelocity,
} from "./movement";

const RETREAT_PROBE_DIST_PX = 44;
/** Default flee goal distance when callers omit a band-specific target. */
const DEFAULT_RETREAT_GOAL_WU = 96;

export function retreatGoalFromThreat(
  ex: number,
  ey: number,
  threatX: number,
  threatY: number,
  goalDistPx: number,
): { x: number; y: number } | null {
  const dx = ex - threatX;
  const dy = ey - threatY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const nx = dx / len;
  const ny = dy / len;
  return { x: ex + nx * goalDistPx, y: ey + ny * goalDistPx };
}

function clampGoalToEnemyPlayBounds(
  enemy: EnemyInstance,
  goalX: number,
  goalY: number,
): { x: number; y: number } {
  const reg = enemy.sprite.scene?.registry;
  const bodyR = reg
    ? worldUnit(enemyCollisionBodyRadius(enemy.defId), reg)
    : enemyCollisionBodyRadius(enemy.defId);
  const bounds = defensePlayBoundsInset(bodyR);
  return clampToDefensePlayBounds(goalX, goalY, bounds);
}

export function snapRetreatGoalToWalkable(
  grid: NavGrid,
  goalX: number,
  goalY: number,
  peerAgents?: readonly NavPeerAgent[],
  agentClearancePx?: number,
  enemy?: EnemyInstance,
): { x: number; y: number } {
  const bounded =
    enemy !== undefined
      ? clampGoalToEnemyPlayBounds(enemy, goalX, goalY)
      : { x: goalX, y: goalY };
  const cell = worldToCell(grid, bounded.x, bounded.y);
  if (!cell) return bounded;
  const walk = nearestWalkable(
    grid,
    cell.col,
    cell.row,
    peerAgents,
    agentClearancePx,
  );
  const center = cellToWorldCenter(grid, walk.col, walk.row);
  if (enemy === undefined) return center;
  return clampGoalToEnemyPlayBounds(enemy, center.x, center.y);
}

function probeDirBlocked(
  grid: NavGrid,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  dist: number,
  peerAgents?: readonly NavPeerAgent[],
  agentClearancePx?: number,
): boolean {
  const len = Math.hypot(dirX, dirY);
  if (len < 1e-6) return true;
  const nx = dirX / len;
  const ny = dirY / len;
  const probeX = x + nx * dist;
  const probeY = y + ny * dist;
  const cell = worldToCell(grid, probeX, probeY);
  if (!cell) return true;
  return cellBlocked(grid, cell.col, cell.row, peerAgents, agentClearancePx);
}

/** Slide along an obstacle tangent when direct flee is blocked and A* has no route. */
export function applyTangentSlideAwayFromThreat(
  enemy: EnemyInstance,
  grid: NavGrid,
  threatX: number,
  threatY: number,
  peerAgents?: readonly NavPeerAgent[],
  agentClearancePx?: number,
  speedMul = 1,
): boolean {
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const dx = ex - threatX;
  const dy = ey - threatY;
  const len = Math.hypot(dx, dy) || 1;
  const awayX = dx / len;
  const awayY = dy / len;

  if (
    !probeDirBlocked(
      grid,
      ex,
      ey,
      awayX,
      awayY,
      RETREAT_PROBE_DIST_PX,
      peerAgents,
      agentClearancePx,
    )
  ) {
    applyDirectVelocity(enemy, awayX, awayY, speedMul);
    return true;
  }

  const t1x = -awayY;
  const t1y = awayX;
  const t2x = awayY;
  const t2y = -awayX;
  const t1ok = !probeDirBlocked(
    grid,
    ex,
    ey,
    t1x,
    t1y,
    RETREAT_PROBE_DIST_PX,
    peerAgents,
    agentClearancePx,
  );
  const t2ok = !probeDirBlocked(
    grid,
    ex,
    ey,
    t2x,
    t2y,
    RETREAT_PROBE_DIST_PX,
    peerAgents,
    agentClearancePx,
  );

  if (t1ok) {
    applyDirectVelocity(enemy, t1x, t1y, speedMul * 0.85);
    return true;
  }
  if (t2ok) {
    applyDirectVelocity(enemy, t2x, t2y, speedMul * 0.85);
    return true;
  }

  setEnemyChaseVelocity(enemy, 0, 0);
  return false;
}

export type ApplyRetreatPathingOpts = {
  enemy: EnemyInstance;
  nav: EnemyNavState;
  grid: NavGrid;
  threatX: number;
  threatY: number;
  deltaMs: number;
  waypointRadius: number;
  peerAgents?: readonly NavPeerAgent[];
  speedMul?: number;
  chaseOpts?: ChaseVelocityOptions;
  retreatGoalDistPx?: number;
  /** Blend strafe tangent into the path waypoint target (javelineer kite). */
  blendMove?: { x: number; y: number; weight: number };
};

function pathLeadsTowardThreat(
  nav: EnemyNavState,
  ex: number,
  ey: number,
  threatX: number,
  threatY: number,
): boolean {
  const tail = nav.path[nav.path.length - 1];
  if (!tail) return true;
  const selfDist = Math.hypot(ex - threatX, ey - threatY);
  const tailDist = Math.hypot(tail.x - threatX, tail.y - threatY);
  return tailDist < selfDist - 6;
}

/** Path away from a threat with the same nav grid + A* as chase approach. */
export function applyRetreatPathing(opts: ApplyRetreatPathingOpts): void {
  const {
    enemy,
    nav,
    grid,
    threatX,
    threatY,
    deltaMs,
    waypointRadius,
    peerAgents,
    speedMul = 1,
    chaseOpts,
  } = opts;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene?.registry;
  const retreatGoalDistPx =
    opts.retreatGoalDistPx ?? worldUnit(DEFAULT_RETREAT_GOAL_WU, reg);
  const agentClearancePx = reg
    ? worldUnit(enemyPathClearancePx(enemy.defId), reg)
    : grid.clearancePx;

  if (
    nav.replanMs <= 0 ||
    nav.path.length === 0 ||
    pathLeadsTowardThreat(nav, ex, ey, threatX, threatY)
  ) {
    const raw = retreatGoalFromThreat(
      ex,
      ey,
      threatX,
      threatY,
      retreatGoalDistPx,
    );
    if (raw) {
      const snapped = snapRetreatGoalToWalkable(
        grid,
        raw.x,
        raw.y,
        peerAgents,
        agentClearancePx,
        enemy,
      );
      replanEnemyPath(
        nav,
        grid,
        ex,
        ey,
        snapped.x,
        snapped.y,
        waypointRadius,
        peerAgents,
        enemy,
      );
    } else {
      nav.path = [];
      nav.pathIndex = 0;
      nav.pathGoalReached = false;
    }
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
    let moveX = nav.path[nav.pathIndex]!.x;
    let moveY = nav.path[nav.pathIndex]!.y;
    const wp = nav.path[nav.pathIndex]!;
    if (Math.hypot(wp.x - ex, wp.y - ey) <= waypointRadius) {
      nav.pathIndex += 1;
    }
    const nextWp = nav.path[nav.pathIndex];
    if (nextWp) {
      moveX = nextWp.x;
      moveY = nextWp.y;
    }
    const blend = opts.blendMove;
    if (blend && blend.weight > 0) {
      const w = Math.min(1, Math.max(0, blend.weight));
      const bLen = Math.hypot(blend.x, blend.y);
      if (bLen > 1e-6) {
        const blendReach = worldUnit(72, reg);
        const bx = (blend.x / bLen) * blendReach;
        const by = (blend.y / bLen) * blendReach;
        moveX = ex + (moveX - ex) * (1 - w) + bx * w;
        moveY = ey + (moveY - ey) * (1 - w) + by * w;
      }
    }
    applyChaseVelocity(
      enemy,
      moveX,
      moveY,
      speedMul,
      chaseOpts ?? { nav, deltaMs },
    );
    return;
  }

  applyTangentSlideAwayFromThreat(
    enemy,
    grid,
    threatX,
    threatY,
    peerAgents,
    agentClearancePx,
    speedMul,
  );
}