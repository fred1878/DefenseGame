import { DEFENSE_MAP, northWallAttackY, PLAYER_AGGRO_RADIUS } from "../../config";
import { playerAggroRadiusWu } from "../../config/shadowformRuntime";
import { worldUnit } from "../../core/worldPixelScale";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, setEnemyChaseVelocity } from "./movement";
import { applyRetreatPathing } from "./retreatPathing";

function followPlannedPath(
  enemy: import("../../entities/Enemy").EnemyInstance,
  nav: import("../EnemyBrain").EnemyNavState,
  goal: { x: number; y: number },
  ex: number,
  ey: number,
  waypointRadius: number,
  deltaMs: number,
): void {
  let moveX = goal.x;
  let moveY = goal.y;
  if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
    const wp = nav.path[nav.pathIndex]!;
    if (Math.hypot(wp.x - ex, wp.y - ey) <= waypointRadius) {
      nav.pathIndex += 1;
    }
    const nextWp = nav.path[nav.pathIndex];
    if (nextWp) {
      moveX = nextWp.x;
      moveY = nextWp.y;
    }
  }
  applyChaseVelocity(enemy, moveX, moveY, 0.92, { nav, deltaMs });
}

export const arrowRainArcherBehavior: EnemyBehavior = (ctx) => {
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
    worldUnit(playerAggroRadiusWu(PLAYER_AGGRO_RADIUS), reg),
    ctx.objective ?? "defendWall",
    reg,
  );
  const desired = resolved.targetKind;
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal = { x: resolved.goalX, y: resolved.goalY };
  const arrow = enemy.combatTuning.arrowRain;
  const wallY = northWallAttackY(reg);

  if (desired === "player" && arrow) {
    const bandSlack = worldUnit(arrow.kiteBandSlackWu, reg);
    const preferred = worldUnit(arrow.preferredRangeWu, reg);
    const attackMax = worldUnit(arrow.attackTriggerRangeWu, reg);
    const distToPlayer = Math.hypot(playerX - ex, playerY - ey);
    if (distToPlayer < preferred - bandSlack) {
      applyRetreatPathing({
        enemy,
        nav,
        grid,
        threatX: playerX,
        threatY: playerY,
        deltaMs,
        waypointRadius,
        peerAgents,
        speedMul: 0.85,
        retreatGoalDistPx: Math.max(
          worldUnit(64, reg),
          preferred - distToPlayer + bandSlack,
        ),
      });
      return { targetX: goal.x, targetY: goal.y, targetKind: desired };
    }
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
    if (distToPlayer <= attackMax) {
      setEnemyChaseVelocity(enemy, 0, 0);
    } else {
      followPlannedPath(enemy, nav, goal, ex, ey, waypointRadius, deltaMs);
    }
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  if (desired === "wall" && arrow) {
    const bandSlack = worldUnit(arrow.kiteBandSlackWu, reg);
    const preferred = worldUnit(arrow.preferredRangeWu, reg);
    const attackMax = worldUnit(arrow.attackTriggerRangeWu, reg);
    const distToWall = ey - wallY;
    if (distToWall < preferred - bandSlack) {
      applyRetreatPathing({
        enemy,
        nav,
        grid,
        threatX: ex,
        threatY: wallY,
        deltaMs,
        waypointRadius,
        peerAgents,
        speedMul: 0.65,
        retreatGoalDistPx: Math.max(
          worldUnit(56, reg),
          preferred - distToWall + bandSlack,
        ),
      });
      return { targetX: goal.x, targetY: goal.y, targetKind: desired };
    }
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
    if (distToWall <= attackMax) {
      setEnemyChaseVelocity(enemy, 0, 0);
    } else {
      followPlannedPath(enemy, nav, goal, ex, ey, waypointRadius, deltaMs);
    }
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

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
  followPlannedPath(enemy, nav, goal, ex, ey, waypointRadius, deltaMs);

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};