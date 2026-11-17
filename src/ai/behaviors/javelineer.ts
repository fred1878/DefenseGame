import { DEFENSE_MAP, northWallAttackY, PLAYER_AGGRO_RADIUS } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import { cellBlocked, worldToCell, type NavGrid } from "../../pathfinding/grid";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyInstance } from "../../entities/Enemy";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, applyDirectVelocity } from "./movement";

const STRAFE_PROBE_DIST = 44;
/** Blend weight for closing distance while in the kite band. */
const RANGE_APPROACH_BLEND = 0.38;
/** Blend weight for backing off while still inside the outer band. */
const RANGE_RETREAT_BLEND = 0.48;
/** Stronger retreat when inside min range (melee danger). */
const CLOSE_RETREAT_BLEND = 0.68;
/** Light radial nudge when sitting on the ideal arc distance. */
const IDEAL_RANGE_NUDGE = 0.2;

function advanceStrafeSign(enemy: EnemyInstance, deltaMs: number): void {
  enemy.behaviorExtra.strafeFlipMs = Math.max(
    0,
    enemy.behaviorExtra.strafeFlipMs - deltaMs,
  );
  if (enemy.behaviorExtra.strafeFlipMs <= 0) {
    enemy.behaviorExtra.strafeSign =
      enemy.behaviorExtra.strafeSign === 1 ? -1 : 1;
    enemy.behaviorExtra.strafeFlipMs =
      enemy.combatTuning.javelineer?.orbitFlipMs ?? 1400;
  }
}

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
    enemy.behaviorExtra.strafeFlipMs =
      enemy.combatTuning.javelineer?.orbitFlipMs ?? 1400;
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

function playerOrbitDirs(
  dx: number,
  dy: number,
  dist: number,
): { nx: number; ny: number; tangentX: number; tangentY: number } {
  const len = dist || 1;
  const nx = dx / len;
  const ny = dy / len;
  return { nx, ny, tangentX: -ny, tangentY: nx };
}

function kiteArcVelocity(
  enemy: EnemyInstance,
  ctx: {
    grid: NavGrid;
    deltaMs: number;
    tangentX: number;
    tangentY: number;
    nx: number;
    ny: number;
    radialBlend: number;
    towardPlayer: boolean;
    speedMul: number;
    peerAgents?: readonly { x: number; y: number }[];
  },
): void {
  advanceStrafeSign(enemy, ctx.deltaMs);
  const sign = resolveStrafeSign(
    enemy,
    ctx.grid,
    ctx.tangentX,
    ctx.tangentY,
    ctx.peerAgents,
  );
  const radialSign = ctx.towardPlayer ? 1 : -1;
  const moveX =
    ctx.tangentX * sign + ctx.nx * radialSign * ctx.radialBlend;
  const moveY =
    ctx.tangentY * sign + ctx.ny * radialSign * ctx.radialBlend;
  applyDirectVelocity(enemy, moveX, moveY, ctx.speedMul);
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
    ctx.objective ?? "defendWall",
  );
  const desired = resolved.targetKind;
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal = { x: resolved.goalX, y: resolved.goalY };

  if (nav.replanMs <= 0 || nav.path.length === 0) {
    replanEnemyPath(
      nav,
      grid,
      ex,
      ey,
      goal.x,
      goal.y,
      waypointRadius,
      peerAgents,
      enemy,
    );
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  const dx = playerX - ex;
  const dy = playerY - ey;
  const dist = Math.hypot(dx, dy);
  const javelineer = enemy.combatTuning.javelineer;

  if (desired === "player" && javelineer) {
    const minRange = worldUnit(javelineer.minRange, reg);
    const maxRange = worldUnit(javelineer.maxRange, reg);
    const bandSlack = worldUnit(28, reg);
    const ideal = (minRange + maxRange) / 2;
    const { nx, ny, tangentX, tangentY } = playerOrbitDirs(dx, dy, dist);

    if (dist < minRange) {
      kiteArcVelocity(enemy, {
        grid,
        deltaMs,
        tangentX,
        tangentY,
        nx,
        ny,
        radialBlend: CLOSE_RETREAT_BLEND,
        towardPlayer: false,
        speedMul: 1.1,
        peerAgents,
      });
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
      const distError = dist - ideal;
      let radialBlend = 0;
      let towardPlayer = false;
      let speedMul = javelineer.strafeSpeedMul;

      if (Math.abs(distError) <= bandSlack) {
        if (distError > bandSlack * 0.4) {
          radialBlend = IDEAL_RANGE_NUDGE;
          towardPlayer = true;
        } else if (distError < -bandSlack * 0.4) {
          radialBlend = IDEAL_RANGE_NUDGE;
          towardPlayer = false;
        }
      } else if (distError > 0) {
        radialBlend = RANGE_APPROACH_BLEND;
        towardPlayer = true;
      } else {
        radialBlend = RANGE_RETREAT_BLEND;
        towardPlayer = false;
        speedMul = Math.max(speedMul, 1.02);
      }

      kiteArcVelocity(enemy, {
        grid,
        deltaMs,
        tangentX,
        tangentY,
        nx,
        ny,
        radialBlend,
        towardPlayer,
        speedMul,
        peerAgents,
      });
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
      advanceStrafeSign(enemy, deltaMs);
      const sign = resolveStrafeSign(enemy, grid, 1, 0, peerAgents);
      applyDirectVelocity(enemy, sign, 0, strafeSpeedMul);
    }
  }

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};