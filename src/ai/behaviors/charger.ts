import { DEFENSE_MAP, PLAYER_AGGRO_RADIUS } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import { hasLineOfSight } from "../../pathfinding/los";
import {
  pathingPeerAgents,
  replanEnemyPath,
  resolveEnemyTarget,
} from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import {
  applyChaseVelocity,
  applyDirectVelocity,
  setEnemyChaseVelocity,
} from "./movement";

export const chargerBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAgents } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene.registry;
  const tune = enemy.combatTuning.charger;
  const extra = enemy.behaviorExtra;
  const waypointRadius = worldUnit(DEFENSE_MAP.pathWaypointRadius, reg);

  if (extra.chargeActiveMs > 0) {
    extra.chargeActiveMs = Math.max(0, extra.chargeActiveMs - deltaMs);
    const dashMul = tune?.dashSpeedMul ?? 2.2;
    applyDirectVelocity(
      enemy,
      extra.chargeDashDirX,
      extra.chargeDashDirY,
      dashMul,
    );
    return {
      targetX: extra.chargeAimX,
      targetY: extra.chargeAimY,
      targetKind: "player",
    };
  }

  if (extra.chargeWindupMs > 0) {
    extra.chargeWindupMs = Math.max(0, extra.chargeWindupMs - deltaMs);
    setEnemyChaseVelocity(enemy, 0, 0);
    if (extra.chargeWindupMs <= 0 && tune) {
      const overshootPx = worldUnit(tune.dashOvershootRange, reg);
      let dx = extra.chargeAimX - ex;
      let dy = extra.chargeAimY - ey;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) {
        dx = 1;
        dy = 0;
      } else {
        dx /= len;
        dy /= len;
      }
      extra.chargeDashDirX = dx;
      extra.chargeDashDirY = dy;
      extra.chargeAimX += dx * overshootPx;
      extra.chargeAimY += dy * overshootPx;
      extra.chargeActiveMs = tune.dashDurationMs;
      extra.chargeCooldownMs = tune.dashCooldownMs;
    }
    return {
      targetX: playerX,
      targetY: playerY,
      targetKind: "player",
    };
  }

  if (extra.chargeCooldownMs > 0) {
    extra.chargeCooldownMs = Math.max(0, extra.chargeCooldownMs - deltaMs);
  }

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
  const goal = { x: resolved.goalX, y: resolved.goalY };
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  if (nav.replanMs <= 0 || nav.path.length === 0) {
    replanEnemyPath(
      nav,
      grid,
      ex,
      ey,
      goal.x,
      goal.y,
      waypointRadius,
      pathingPeerAgents(peerAgents, resolved.targetKind, playerX, playerY),
      enemy,
    );
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  const dist = Math.hypot(playerX - ex, playerY - ey);
  if (
    tune &&
    resolved.targetKind === "player" &&
    extra.chargeCooldownMs <= 0 &&
    dist <= worldUnit(tune.dashTriggerRange, reg) &&
    hasLineOfSight(grid, ex, ey, playerX, playerY)
  ) {
    extra.chargeWindupMs = tune.dashWindupMs;
    extra.chargeHitThisDash = false;
    extra.chargeAimX = playerX;
    extra.chargeAimY = playerY;
    setEnemyChaseVelocity(enemy, 0, 0);
    return {
      targetX: playerX,
      targetY: playerY,
      targetKind: "player",
    };
  }

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

  return { targetX: goal.x, targetY: goal.y, targetKind: resolved.targetKind };
};