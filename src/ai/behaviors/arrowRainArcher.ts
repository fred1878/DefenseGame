import { DEFENSE_MAP, northWallAttackY, PLAYER_AGGRO_RADIUS } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import {
  applyChaseVelocity,
  applyDirectVelocity,
  setEnemyChaseVelocity,
} from "./movement";

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

  const distToPlayer = Math.hypot(playerX - ex, playerY - ey);
  const arrow = enemy.combatTuning.arrowRain;
  const wallY = northWallAttackY();
  const distToWall = ey - wallY;

  if (desired === "player" && arrow) {
    const bandSlack = worldUnit(24, reg);
    const preferred = worldUnit(arrow.preferredRange, reg);
    const attackMax = worldUnit(arrow.attackTriggerRange, reg);
    if (distToPlayer < preferred - bandSlack) {
      applyDirectVelocity(enemy, ex - playerX, ey - playerY, 0.85);
    } else if (distToPlayer <= attackMax) {
      setEnemyChaseVelocity(enemy, 0, 0);
    } else {
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
      applyChaseVelocity(enemy, moveX, moveY, 0.92, { nav, deltaMs });
    }
  } else if (desired === "wall" && arrow) {
    const bandSlack = worldUnit(24, reg);
    const preferred = worldUnit(arrow.preferredRange, reg);
    const attackMax = worldUnit(arrow.attackTriggerRange, reg);
    if (distToWall < preferred - bandSlack) {
      applyDirectVelocity(enemy, 0, 1, 0.65);
    } else if (distToWall <= attackMax) {
      setEnemyChaseVelocity(enemy, 0, 0);
    } else {
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
      applyChaseVelocity(enemy, moveX, moveY, 0.92, { nav, deltaMs });
    }
  } else {
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
    applyChaseVelocity(enemy, moveX, moveY, 0.92, { nav, deltaMs });
  }

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};