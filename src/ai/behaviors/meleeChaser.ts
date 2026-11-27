import { tuning } from "../../tuning/gameTuning";
import { DEFENSE_MAP } from "../../config";
import { playerAggroRadiusWu } from "../../combat/shadowformRuntime";
import { worldUnit } from "../../config/worldScale";
import { hasLineOfSight } from "../../pathfinding/los";
import {
  type EnemyTargetKind,
  pathingPeerAgents,
  replanEnemyPath,
  resolveEnemyTarget,
  wallPathingPlayerClearancePx,
} from "../brainShared";
import type { EnemyBehavior, EnemyBehaviorContext } from "./types";
import {
  applyChaseVelocity,
  applyPlayerMeleeHold,
  applyWallMeleeHold,
  commitPlayerChasePathGoal,
  meleeChasePeersFromAllies,
  meleePackAnchorHysteresisPx,
  meleePackPlayerAnchor,
  playerChaseVelocityOpts,
  playerMeleeChaseHoldPoint,
  shouldHoldAtPlayerMelee,
  shouldHoldAtWallMelee,
  shouldHoldMeleeChaseChordBlocked,
  shouldMeleeLosShortcutToPlayer,
} from "./movement";

export const meleeChaserBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAllies } = ctx;
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
  const desired = resolved.targetKind;
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal = { x: resolved.goalX, y: resolved.goalY };
  const holdAtWall = shouldHoldAtWallMelee(enemy, desired);

  const packHysteresisPx = meleePackAnchorHysteresisPx(reg);
  const packAnchorActive =
    desired === "player" &&
    (!nav.pathGoalReached ||
      shouldHoldMeleeChaseChordBlocked(
        enemy,
        playerX,
        playerY,
        meleeChasePeersFromAllies(enemy.id, peerAllies),
      ));
  const packPlayer = meleePackPlayerAnchor(
    nav,
    playerX,
    playerY,
    packAnchorActive,
    packHysteresisPx,
  );

  const chaseVelocityOpts = playerChaseVelocityOpts(enemy, {
    nav,
    deltaMs,
    targetKind: desired,
    playerX: packPlayer.x,
    playerY: packPlayer.y,
    peerAllies,
  });
  const chordBlocked =
    desired === "player" &&
    shouldHoldMeleeChaseChordBlocked(
      enemy,
      packPlayer.x,
      packPlayer.y,
      chaseVelocityOpts.meleeChasePeers,
    );

  const pathActive = nav.path.length > 0 && nav.pathIndex < nav.path.length;
  if (!holdAtWall && (nav.replanMs <= 0 || nav.path.length === 0)) {
    replanMeleeChasePath(ctx, ex, ey, goal, desired, waypointRadius);
  }

  if (holdAtWall) {
    applyWallMeleeHold(enemy);
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  const move = meleeChaseMoveTarget(ctx, {
    ex,
    ey,
    goal,
    desired,
    packPlayer,
    pathActive,
    chordBlocked,
    waypointRadius,
  });
  if (!move) {
    applyPlayerMeleeHold(enemy);
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }
  const moveX = move.x;
  const moveY = move.y;

  applyChaseVelocity(enemy, moveX, moveY, 1, chaseVelocityOpts);

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};

function replanMeleeChasePath(
  ctx: EnemyBehaviorContext,
  ex: number,
  ey: number,
  goal: { x: number; y: number },
  desired: EnemyTargetKind,
  waypointRadius: number,
): void {
  const { enemy, nav, playerX, playerY } = ctx;
  const wasReachable = nav.pathGoalReached;
  replanEnemyPath(
    nav,
    ctx.grid,
    ex,
    ey,
    goal.x,
    goal.y,
    waypointRadius,
    pathingPeerAgents(
      ctx.peerAgents,
      desired,
      playerX,
      playerY,
      wallPathingPlayerClearancePx(enemy.sprite.scene.registry),
    ),
    enemy,
  );
  if (desired === "player") {
    commitPlayerChasePathGoal(
      nav,
      nav.pathGoalReached,
      wasReachable,
      shouldHoldAtPlayerMelee(enemy, desired, playerX, playerY),
    );
  }
  nav.replanMs = DEFENSE_MAP.pathReplanMs;
}

type MeleeChaseFrame = {
  ex: number;
  ey: number;
  goal: { x: number; y: number };
  desired: EnemyTargetKind;
  packPlayer: { x: number; y: number };
  /** Read before this frame's replan. */
  pathActive: boolean;
  chordBlocked: boolean;
  waypointRadius: number;
};

/** Where a melee chaser steers this frame, or null to hold in place. */
function meleeChaseMoveTarget(
  ctx: EnemyBehaviorContext,
  f: MeleeChaseFrame,
): { x: number; y: number } | null {
  const { enemy, nav, playerX, playerY } = ctx;
  const toPlayer = f.desired === "player";
  let move = toPlayer
    ? playerMeleeChaseHoldPoint(enemy, f.packPlayer.x, f.packPlayer.y)
    : { x: f.goal.x, y: f.goal.y };

  if (
    toPlayer &&
    shouldMeleeLosShortcutToPlayer(enemy, nav, playerX, playerY) &&
    hasLineOfSight(ctx.grid, f.ex, f.ey, playerX, playerY) &&
    !f.chordBlocked
  ) {
    return { x: playerX, y: playerY };
  }
  if (f.pathActive) {
    // `pathActive` was read before this frame's replan; a replan that found no
    // path leaves `nav.path` empty, so the waypoint can be missing here.
    const wp = nav.path[nav.pathIndex];
    if (wp && Math.hypot(wp.x - f.ex, wp.y - f.ey) <= f.waypointRadius) {
      nav.pathIndex += 1;
    }
    const nextWp = nav.path[nav.pathIndex];
    if (nextWp) move = { x: nextWp.x, y: nextWp.y };
    return move;
  }
  if (!toPlayer) return move;
  if (f.chordBlocked) {
    const tail = nav.path[nav.path.length - 1];
    if (tail && Math.hypot(tail.x - f.ex, tail.y - f.ey) > 1) {
      return { x: tail.x, y: tail.y };
    }
    return null;
  }
  if (!nav.pathGoalReached) {
    const tail = nav.path[nav.path.length - 1];
    if (tail && Math.hypot(tail.x - f.ex, tail.y - f.ey) > 1) {
      return { x: tail.x, y: tail.y };
    }
    if (tail) return null;
    return playerMeleeChaseHoldPoint(enemy, f.packPlayer.x, f.packPlayer.y);
  }
  return move;
}
