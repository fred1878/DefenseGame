import { nextPathMoveTarget } from "./shared/pathApproach";
/**
 * Shared steps for the ranged enemy behaviours (stationaryRanged, arrowRainArcher,
 * rangedHybrid, lobber, javelineer): per-tick target resolution, path replanning,
 * waypoint following and the "retreat / hold / approach" kite band.
 */
import { tuning } from "../../tuning/gameTuning";
import { DEFENSE_MAP } from "../../config";
import { playerAggroRadiusWu } from "../../combat/shadowformRuntime";
import { worldUnit } from "../../config/worldScale";
import type { NavPeerAgent } from "../../pathfinding/grid";
import {
  replanEnemyPath,
  resolveEnemyTarget,
  type EnemyNavState,
  type EnemyTargetKind,
} from "../brainShared";
import type { BehaviorMoveResult, EnemyBehaviorContext } from "./types";
import { applyChaseVelocity, setEnemyChaseVelocity } from "./movement";
import { applyRetreatPathing } from "./retreatPathing";

export type BehaviorFrame = {
  ex: number;
  ey: number;
  reg: Phaser.Data.DataManager;
  waypointRadius: number;
  desired: EnemyTargetKind;
  goal: { x: number; y: number };
};

/** Resolve this tick's target and tick down the replan timer. */
export function beginBehaviorFrame(ctx: EnemyBehaviorContext): BehaviorFrame {
  const { enemy, nav, grid, playerX, playerY, deltaMs } = ctx;
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
    worldUnit(playerAggroRadiusWu(tuning("enemyAi").playerAggroRadiusWu), reg),
    ctx.objective ?? "defendWall",
    reg,
  );
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);
  return {
    ex,
    ey,
    reg,
    waypointRadius,
    desired: resolved.targetKind,
    goal: { x: resolved.goalX, y: resolved.goalY },
  };
}

/** Behaviour result for this frame: always reports the resolved goal. */
export function frameResult(frame: BehaviorFrame): BehaviorMoveResult {
  return {
    targetX: frame.goal.x,
    targetY: frame.goal.y,
    targetKind: frame.desired,
  };
}

/** True when the replan timer expired or there is no path to follow. */
export function pathReplanDue(nav: EnemyNavState): boolean {
  return nav.replanMs <= 0 || nav.path.length === 0;
}

/** Replan toward the frame goal when {@link pathReplanDue}. */
export function replanPathIfDue(
  ctx: EnemyBehaviorContext,
  frame: BehaviorFrame,
  peerAgents: readonly NavPeerAgent[] | undefined = ctx.peerAgents,
): boolean {
  const { nav } = ctx;
  if (!pathReplanDue(nav)) return false;
  replanEnemyPath(
    nav,
    ctx.grid,
    frame.ex,
    frame.ey,
    frame.goal.x,
    frame.goal.y,
    frame.waypointRadius,
    peerAgents,
    ctx.enemy,
  );
  nav.replanMs = DEFENSE_MAP.pathReplanMs;
  return true;
}

/** Advance past a reached waypoint and steer toward the next one (or the goal). */
export function followPlannedPath(
  ctx: EnemyBehaviorContext,
  frame: BehaviorFrame,
  speedMul: number,
): void {
  const { enemy, nav, deltaMs } = ctx;
  const move = nextPathMoveTarget(
    nav,
    frame.ex,
    frame.ey,
    frame.goal.x,
    frame.goal.y,
    frame.waypointRadius,
  );
  applyChaseVelocity(enemy, move.x, move.y, speedMul, { nav, deltaMs });
}

export type KiteBandOptions = {
  /** Distance to the threat (player, or wall line). */
  dist: number;
  preferred: number;
  bandSlack: number;
  attackMax: number;
  threatX: number;
  threatY: number;
  retreatSpeedMul: number;
  /** Minimum retreat goal distance, in world units. */
  retreatMinWu: number;
  followSpeedMul: number;
};

/**
 * Kite band: retreat when closer than `preferred - bandSlack`, otherwise replan,
 * then hold still inside `attackMax` or follow the path toward the goal.
 */
export function applyKiteBand(
  ctx: EnemyBehaviorContext,
  frame: BehaviorFrame,
  opts: KiteBandOptions,
): BehaviorMoveResult {
  const { dist, preferred, bandSlack } = opts;
  if (dist < preferred - bandSlack) {
    applyRetreatPathing({
      enemy: ctx.enemy,
      nav: ctx.nav,
      grid: ctx.grid,
      threatX: opts.threatX,
      threatY: opts.threatY,
      deltaMs: ctx.deltaMs,
      waypointRadius: frame.waypointRadius,
      peerAgents: ctx.peerAgents,
      speedMul: opts.retreatSpeedMul,
      retreatGoalDistPx: Math.max(
        worldUnit(opts.retreatMinWu, frame.reg),
        preferred - dist + bandSlack,
      ),
    });
    return frameResult(frame);
  }
  replanPathIfDue(ctx, frame);
  if (dist <= opts.attackMax) {
    setEnemyChaseVelocity(ctx.enemy, 0, 0);
  } else {
    followPlannedPath(ctx, frame, opts.followSpeedMul);
  }
  return frameResult(frame);
}
