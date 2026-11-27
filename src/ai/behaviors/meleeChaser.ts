import { DEFENSE_MAP, PLAYER_AGGRO_RADIUS } from "../../config";
import { playerAggroRadiusWu } from "../../config/shadowformRuntime";
import { worldUnit } from "../../config/worldScale";
import { hasLineOfSight } from "../../pathfinding/los";
import {
  pathingPeerAgents,
  replanEnemyPath,
  resolveEnemyTarget,
  wallPathingPlayerClearancePx,
} from "../brainShared";
import type { EnemyBehavior } from "./types";
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
  const {
    enemy,
    nav,
    grid,
    playerX,
    playerY,
    deltaMs,
    peerAgents,
    peerAllies,
  } = ctx;
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
    worldUnit(playerAggroRadiusWu(PLAYER_AGGRO_RADIUS), reg),
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
    const wasReachable = nav.pathGoalReached;
    replanEnemyPath(
      nav,
      grid,
      ex,
      ey,
      goal.x,
      goal.y,
      waypointRadius,
      pathingPeerAgents(
        peerAgents,
        resolved.targetKind,
        playerX,
        playerY,
        wallPathingPlayerClearancePx(reg),
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

  if (holdAtWall) {
    applyWallMeleeHold(enemy);
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  let moveX = goal.x;
  let moveY = goal.y;
  if (desired === "player") {
    const hold = playerMeleeChaseHoldPoint(enemy, packPlayer.x, packPlayer.y);
    moveX = hold.x;
    moveY = hold.y;
  }

  if (
    desired === "player" &&
    shouldMeleeLosShortcutToPlayer(enemy, nav, playerX, playerY) &&
    hasLineOfSight(grid, ex, ey, playerX, playerY) &&
    !chordBlocked
  ) {
    moveX = playerX;
    moveY = playerY;
  } else if (pathActive) {
    // `pathActive` was read before this frame's replan; a replan that found no
    // path leaves `nav.path` empty, so the waypoint can be missing here.
    const wp = nav.path[nav.pathIndex];
    if (wp && Math.hypot(wp.x - ex, wp.y - ey) <= waypointRadius) {
      nav.pathIndex += 1;
    }
    const nextWp = nav.path[nav.pathIndex];
    if (nextWp) {
      moveX = nextWp.x;
      moveY = nextWp.y;
    }
  } else if (chordBlocked && desired === "player") {
    const tail = nav.path[nav.path.length - 1];
    if (tail && Math.hypot(tail.x - ex, tail.y - ey) > 1) {
      moveX = tail.x;
      moveY = tail.y;
    } else {
      applyPlayerMeleeHold(enemy);
      return { targetX: goal.x, targetY: goal.y, targetKind: desired };
    }
  } else if (desired === "player" && !nav.pathGoalReached) {
    const tail = nav.path[nav.path.length - 1];
    if (tail && Math.hypot(tail.x - ex, tail.y - ey) > 1) {
      moveX = tail.x;
      moveY = tail.y;
    } else if (tail) {
      applyPlayerMeleeHold(enemy);
      return { targetX: goal.x, targetY: goal.y, targetKind: desired };
    } else {
      const hold = playerMeleeChaseHoldPoint(enemy, packPlayer.x, packPlayer.y);
      moveX = hold.x;
      moveY = hold.y;
    }
  }

  applyChaseVelocity(enemy, moveX, moveY, 1, chaseVelocityOpts);

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};
