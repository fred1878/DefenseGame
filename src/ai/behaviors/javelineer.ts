import { DEFENSE_MAP, northWallAttackY, PLAYER_AGGRO_RADIUS } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import { cellBlocked, worldToCell, type NavGrid } from "../../pathfinding/grid";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyInstance } from "../../entities/Enemy";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, applyDirectVelocity } from "./movement";

const STRAFE_PROBE_DIST = 44;

function strafeTangentBlocked(
  grid: NavGrid,
  x: number,
  y: number,
  tangentX: number,
  tangentY: number,
  peerAgents?: readonly { x: number; y: number }[],
): boolean {
  const probeX = x + tangentX * STRAFE_PROBE_DIST;
  const probeY = y + tangentY * STRAFE_PROBE_DIST;
  const cell = worldToCell(grid, probeX, probeY);
  if (!cell) return true;
  return cellBlocked(grid, cell.col, cell.row, peerAgents);
}

function resolveStrafeSign(
  enemy: EnemyInstance,
  grid: NavGrid,
  tangentX: number,
  tangentY: number,
  peerAgents?: readonly { x: number; y: number }[],
): 1 | -1 {
  let sign = enemy.behaviorExtra.strafeSign;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  if (
    strafeTangentBlocked(grid, ex, ey, tangentX * sign, tangentY * sign, peerAgents)
  ) {
    sign = sign === 1 ? -1 : 1;
    enemy.behaviorExtra.strafeSign = sign;
    if (
      strafeTangentBlocked(
        grid,
        ex,
        ey,
        tangentX * sign,
        tangentY * sign,
        peerAgents,
      )
    ) {
      enemy.sprite.setVelocity(0, 0);
    }
  }
  return sign;
}

export const javelineerBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAgents } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene.registry;
  const waypointRadius = worldUnit(DEFENSE_MAP.pathWaypointRadius, reg);
  const resolved = resolveEnemyTarget(
    nav,
    grid,
    ex,
    ey,
    playerX,
    playerY,
    deltaMs,
    worldUnit(PLAYER_AGGRO_RADIUS, reg),
  );
  const desired = resolved.targetKind;
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal = { x: resolved.goalX, y: resolved.goalY };

  if (nav.replanMs <= 0 || nav.path.length === 0) {
    replanEnemyPath(nav, grid, ex, ey, goal.x, goal.y, waypointRadius, peerAgents);
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  const dx = playerX - ex;
  const dy = playerY - ey;
  const dist = Math.hypot(dx, dy);
  const javelineer = enemy.combatTuning.javelineer;

  if (desired === "player" && javelineer) {
    const minRange = worldUnit(javelineer.minRange, reg);
    const maxRange = worldUnit(javelineer.maxRange, reg);
    if (dist < minRange) {
      applyDirectVelocity(enemy, ex - playerX, ey - playerY, 1.05);
    } else if (dist > maxRange) {
      let moveX = goal.x;
      let moveY = goal.y;
      if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
        const wp = nav.path[nav.pathIndex]!;
        const d = Math.hypot(wp.x - ex, wp.y - ey);
        if (d <= waypointRadius) {
          nav.pathIndex += 1;
        }
        const nextWp = nav.path[nav.pathIndex];
        if (nextWp) {
          moveX = nextWp.x;
          moveY = nextWp.y;
        }
      }
      applyChaseVelocity(enemy, moveX, moveY, 1.08, { nav, deltaMs });
    } else {
      const len = dist || 1;
      const nx = dx / len;
      const ny = dy / len;
      const tangentX = -ny;
      const tangentY = nx;
      const sign = resolveStrafeSign(
        enemy,
        grid,
        tangentX,
        tangentY,
        peerAgents,
      );
      applyDirectVelocity(
        enemy,
        tangentX * sign,
        tangentY * sign,
        javelineer.strafeSpeedMul,
      );
    }
  } else if (javelineer) {
    const wallY = northWallAttackY();
    const distToWall = ey - wallY;
    const minRange = worldUnit(javelineer.minRange, reg);
    const maxRange = worldUnit(javelineer.maxRange, reg);
    const { strafeSpeedMul } = javelineer;
    if (distToWall < minRange) {
      applyDirectVelocity(enemy, 0, 1, 1.05);
    } else if (distToWall > maxRange) {
      let moveX = goal.x;
      let moveY = goal.y;
      if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
        const wp = nav.path[nav.pathIndex]!;
        const d = Math.hypot(wp.x - ex, wp.y - ey);
        if (d <= waypointRadius) {
          nav.pathIndex += 1;
        }
        const nextWp = nav.path[nav.pathIndex];
        if (nextWp) {
          moveX = nextWp.x;
          moveY = nextWp.y;
        }
      }
      applyChaseVelocity(enemy, moveX, moveY, 1, { nav, deltaMs });
    } else {
      const sign = resolveStrafeSign(enemy, grid, 1, 0, peerAgents);
      applyDirectVelocity(enemy, sign, 0, strafeSpeedMul);
    }
  }

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};