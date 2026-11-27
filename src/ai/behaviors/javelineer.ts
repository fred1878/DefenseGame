import { tuning } from "../../tuning/gameTuning";
import { northWallAttackY } from "../../config";
import { worldUnit } from "../../config/worldScale";
import {
  cellBlocked,
  worldToCell,
  type NavGrid,
  type NavPeerAgent,
} from "../../pathfinding/grid";
import type { EnemyInstance } from "../../entities/Enemy";
import type { EnemyJavelineerCombat } from "../../core/enemyTuning";
import type { EnemyBehavior, EnemyBehaviorContext } from "./types";
import {
  applyChaseVelocity,
  applyDirectVelocity,
  setEnemyChaseVelocity,
} from "./movement";
import {
  type BehaviorFrame,
  beginBehaviorFrame,
  followPlannedPath,
  frameResult,
  replanPathIfDue,
} from "./rangedKite";
import { applyRetreatPathing } from "./retreatPathing";

/** Movement tuning shared by every javelineer (`enemy-ai.json` `javelineer`). */
function moveTune() {
  return tuning("enemyAi").javelineer;
}

function advanceStrafeSign(
  enemy: EnemyInstance,
  deltaMs: number,
  orbitFlipMs: number,
): void {
  enemy.behaviorExtra.strafeFlipMs = Math.max(
    0,
    enemy.behaviorExtra.strafeFlipMs - deltaMs,
  );
  if (enemy.behaviorExtra.strafeFlipMs <= 0) {
    enemy.behaviorExtra.strafeSign =
      enemy.behaviorExtra.strafeSign === 1 ? -1 : 1;
    enemy.behaviorExtra.strafeFlipMs = orbitFlipMs;
  }
}

function strafeTangentBlocked(
  grid: NavGrid,
  x: number,
  y: number,
  tangentX: number,
  tangentY: number,
  peerAgents?: readonly NavPeerAgent[],
): boolean {
  const probe = moveTune().strafeProbeDistPx;
  const probeX = x + tangentX * probe;
  const probeY = y + tangentY * probe;
  const cell = worldToCell(grid, probeX, probeY);
  if (!cell) return true;
  return cellBlocked(grid, cell.col, cell.row, peerAgents);
}

function resolveStrafeSign(
  enemy: EnemyInstance,
  grid: NavGrid,
  tangentX: number,
  tangentY: number,
  orbitFlipMs: number,
  peerAgents?: readonly NavPeerAgent[],
): 1 | -1 {
  let sign = enemy.behaviorExtra.strafeSign;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
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
    sign = sign === 1 ? -1 : 1;
    enemy.behaviorExtra.strafeSign = sign;
    enemy.behaviorExtra.strafeFlipMs = orbitFlipMs;
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
      setEnemyChaseVelocity(enemy, 0, 0);
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
  nav: import("../brainShared").EnemyNavState,
  ctx: {
    grid: NavGrid;
    deltaMs: number;
    waypointRadius: number;
    threatX: number;
    threatY: number;
    tangentX: number;
    tangentY: number;
    nx: number;
    ny: number;
    radialBlend: number;
    towardPlayer: boolean;
    speedMul: number;
    orbitFlipMs: number;
    peerAgents?: readonly NavPeerAgent[] | undefined;
    retreatGoalDistPx?: number | undefined;
  },
): void {
  advanceStrafeSign(enemy, ctx.deltaMs, ctx.orbitFlipMs);
  const sign = resolveStrafeSign(
    enemy,
    ctx.grid,
    ctx.tangentX,
    ctx.tangentY,
    ctx.orbitFlipMs,
    ctx.peerAgents,
  );
  const radialSign = ctx.towardPlayer ? 1 : -1;
  const tangentX = ctx.tangentX * sign;
  const tangentY = ctx.tangentY * sign;

  if (
    !ctx.towardPlayer &&
    ctx.radialBlend > tuning("enemyAi").retreat.blendMinWeight
  ) {
    const strafeWeight = 1 / (1 + ctx.radialBlend);
    applyRetreatPathing({
      enemy,
      nav,
      grid: ctx.grid,
      threatX: ctx.threatX,
      threatY: ctx.threatY,
      deltaMs: ctx.deltaMs,
      waypointRadius: ctx.waypointRadius,
      peerAgents: ctx.peerAgents,
      speedMul: ctx.speedMul,
      retreatGoalDistPx: ctx.retreatGoalDistPx,
      blendMove: { x: tangentX, y: tangentY, weight: strafeWeight },
    });
    return;
  }

  const moveX = tangentX + ctx.nx * radialSign * ctx.radialBlend;
  const moveY = tangentY + ctx.ny * radialSign * ctx.radialBlend;
  applyDirectVelocity(enemy, moveX, moveY, ctx.speedMul);
}

export const javelineerBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, deltaMs } = ctx;
  const frame = beginBehaviorFrame(ctx);
  const javelineer = enemy.combatTuning.javelineer;

  if (frame.desired === "player" && javelineer) {
    javelineerVsPlayer(ctx, frame, javelineer);
  } else if (javelineer) {
    javelineerVsWall(ctx, frame, javelineer);
  } else if (replanPathIfDue(ctx, frame)) {
    // Untuned javelineer only re-steers on the ticks it replans.
    applyChaseVelocity(enemy, frame.goal.x, frame.goal.y, 1, { nav, deltaMs });
  }

  return frameResult(frame);
};

/** Keep the player inside the throw band: retreat, close in, or strafe. */
function javelineerVsPlayer(
  ctx: EnemyBehaviorContext,
  frame: BehaviorFrame,
  javelineer: EnemyJavelineerCombat,
): void {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAgents } = ctx;
  const { ex, ey, reg, waypointRadius } = frame;
  const dx = playerX - ex;
  const dy = playerY - ey;
  const dist = Math.hypot(dx, dy);
  const minRange = worldUnit(javelineer.minRangeWu, reg);
  const maxRange = worldUnit(javelineer.maxRangeWu, reg);
  const bandSlack = worldUnit(javelineer.kiteBandSlackWu, reg);
  const ideal = (minRange + maxRange) / 2;
  const { nx, ny, tangentX, tangentY } = playerOrbitDirs(dx, dy, dist);
  const move = moveTune();
  const { orbitFlipMs } = javelineer;

  if (dist < minRange) {
    kiteArcVelocity(enemy, nav, {
      grid,
      deltaMs,
      waypointRadius,
      threatX: playerX,
      threatY: playerY,
      tangentX,
      tangentY,
      nx,
      ny,
      radialBlend: move.closeRetreatBlend,
      towardPlayer: false,
      speedMul: move.closeRetreatSpeedMul,
      orbitFlipMs,
      peerAgents,
      retreatGoalDistPx: Math.max(
        minRange - dist + worldUnit(move.closeRetreatExtraWu, reg),
        worldUnit(move.closeRetreatMinWu, reg),
      ),
    });
  } else if (dist > maxRange) {
    replanPathIfDue(ctx, frame);
    followPlannedPath(ctx, frame, move.approachSpeedMul);
  } else {
    const distError = dist - ideal;
    let radialBlend = 0;
    let towardPlayer = false;
    let speedMul = javelineer.strafeSpeedMul;

    if (Math.abs(distError) <= bandSlack) {
      const nudgeAt = bandSlack * move.idealBandFrac;
      if (distError > nudgeAt) {
        radialBlend = move.idealRangeNudge;
        towardPlayer = true;
      } else if (distError < -nudgeAt) {
        radialBlend = move.idealRangeNudge;
        towardPlayer = false;
      }
    } else if (distError > 0) {
      radialBlend = move.rangeApproachBlend;
      towardPlayer = true;
    } else {
      radialBlend = move.rangeRetreatBlend;
      towardPlayer = false;
      speedMul = Math.max(speedMul, move.bandRetreatMinSpeedMul);
    }

    kiteArcVelocity(enemy, nav, {
      grid,
      deltaMs,
      waypointRadius,
      threatX: playerX,
      threatY: playerY,
      tangentX,
      tangentY,
      nx,
      ny,
      radialBlend,
      towardPlayer,
      speedMul,
      orbitFlipMs,
      peerAgents,
      retreatGoalDistPx: !towardPlayer
        ? Math.max(
            ideal - dist + bandSlack,
            worldUnit(move.bandRetreatMinWu, reg),
          )
        : undefined,
    });
  }
}

/** Hold the wall throw band: back off, approach, or strafe along the wall. */
function javelineerVsWall(
  ctx: EnemyBehaviorContext,
  frame: BehaviorFrame,
  javelineer: EnemyJavelineerCombat,
): void {
  const { enemy, nav, grid, deltaMs, peerAgents } = ctx;
  const { ex, ey, reg, waypointRadius } = frame;
  const wallY = northWallAttackY(reg);
  const distToWall = ey - wallY;
  const minRange = worldUnit(javelineer.minRangeWu, reg);
  const maxRange = worldUnit(javelineer.maxRangeWu, reg);
  const { strafeSpeedMul, orbitFlipMs } = javelineer;
  const move = moveTune();
  if (distToWall < minRange) {
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: ex,
      threatY: wallY,
      deltaMs,
      waypointRadius,
      peerAgents,
      speedMul: move.wallRetreatSpeedMul,
      retreatGoalDistPx: Math.max(
        minRange - distToWall + worldUnit(move.wallRetreatExtraWu, reg),
        worldUnit(move.wallRetreatMinWu, reg),
      ),
    });
  } else if (distToWall > maxRange) {
    replanPathIfDue(ctx, frame);
    followPlannedPath(ctx, frame, 1);
  } else {
    advanceStrafeSign(enemy, deltaMs, orbitFlipMs);
    const sign = resolveStrafeSign(enemy, grid, 1, 0, orbitFlipMs, peerAgents);
    applyDirectVelocity(enemy, sign, 0, strafeSpeedMul);
  }
}
