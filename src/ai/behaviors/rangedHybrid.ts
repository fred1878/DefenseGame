import { DEFENSE_MAP, PLAYER_AGGRO_RADIUS } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import {
  applyChaseVelocity,
  applyDirectVelocity,
  setEnemyChaseVelocity,
} from "./movement";

export const rangedHybridBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAgents } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene.registry;
  const waypointRadius = worldUnit(DEFENSE_MAP.pathWaypointRadius, reg);
  const hybrid = enemy.combatTuning.hybrid;
  const ranged = enemy.combatTuning.stationaryRanged;
  const extra = enemy.rangedHybrid;
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

  const targetX = desired === "player" ? playerX : goal.x;
  const targetY = desired === "player" ? playerY : goal.y;
  const dist = Math.hypot(targetX - ex, targetY - ey);

  if (
    extra?.mode === "retreat" &&
    desired === "player" &&
    hybrid
  ) {
    applyDirectVelocity(enemy, ex - targetX, ey - targetY, 1.05);
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  if (
    ranged &&
    (enemyIsAttacking(enemy.combat) ||
      (extra?.mode === "ranged" &&
        dist <= worldUnit(ranged.attackTriggerRange, reg) &&
        enemy.combat.cooldownMs <= 0))
  ) {
    if (extra?.mode !== "melee") {
      setEnemyChaseVelocity(enemy, 0, 0);
      return { targetX: goal.x, targetY: goal.y, targetKind: desired };
    }
  }

  let moveX = goal.x;
  let moveY = goal.y;

  if (
    extra?.mode === "melee" &&
    desired === "player"
  ) {
    moveX = playerX;
    moveY = playerY;
    applyChaseVelocity(enemy, moveX, moveY, 1.08, {
      nav,
      deltaMs,
      targetKind: desired,
    });
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

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

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};