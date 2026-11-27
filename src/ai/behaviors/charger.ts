import {
  chaseToward,
  nextPathMoveTarget,
  replanApproachPathIfDue,
} from "./shared/pathApproach";
import { tuning } from "../../tuning/gameTuning";
import { DEFENSE_MAP } from "../../config";
import { playerAggroRadiusWu } from "../../combat/rules/shadowformRuntime";
import { worldUnit } from "../../config/worldScale";
import { hasLineOfSight } from "../../pathfinding/los";
import { resolveEnemyTarget } from "../brainShared";
import type { EnemyBehavior } from "./types";
import { applyDirectVelocity, setEnemyChaseVelocity } from "./movement";
import { spawnChargerChargeStartSmokeFx } from "../../combat/fx/ChargerChargeSmokeFx";

export const chargerBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs } = ctx;
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
      const overshootPx = worldUnit(tune.dashOvershootRangeWu, reg);
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
    worldUnit(playerAggroRadiusWu(tuning("enemyAi").playerAggroRadiusWu), reg),
    ctx.objective ?? "defendWall",
    reg,
  );
  const goal = { x: resolved.goalX, y: resolved.goalY };
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  replanApproachPathIfDue(
    ctx,
    ex,
    ey,
    goal.x,
    goal.y,
    resolved.targetKind,
    waypointRadius,
  );

  const dist = Math.hypot(playerX - ex, playerY - ey);
  if (
    tune &&
    resolved.targetKind === "player" &&
    extra.chargeCooldownMs <= 0 &&
    dist >= worldUnit(tune.dashMinRangeWu, reg) &&
    dist <= worldUnit(tune.dashTriggerRangeWu, reg) &&
    hasLineOfSight(grid, ex, ey, playerX, playerY)
  ) {
    extra.chargeWindupMs = tune.dashWindupMs;
    extra.chargeHitThisDash = false;
    extra.chargeAimX = playerX;
    extra.chargeAimY = playerY;
    setEnemyChaseVelocity(enemy, 0, 0);
    const chargeScene = enemy.sprite.scene;
    if (chargeScene) {
      spawnChargerChargeStartSmokeFx(chargeScene, ex, ey, playerX < ex);
    }
    return {
      targetX: playerX,
      targetY: playerY,
      targetKind: "player",
    };
  }

  const move = nextPathMoveTarget(nav, ex, ey, goal.x, goal.y, waypointRadius);
  chaseToward(ctx, move, 1, resolved.targetKind);

  return { targetX: goal.x, targetY: goal.y, targetKind: resolved.targetKind };
};
