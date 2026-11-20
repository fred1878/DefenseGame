import { DEFENSE_MAP, northWallAttackY, PLAYER_AGGRO_RADIUS } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, applyDirectVelocity } from "./movement";

export const stationaryRangedBehavior: EnemyBehavior = (ctx) => {
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

  const tune = enemy.combatTuning.stationaryRanged;
  if (!tune) {
    applyChaseVelocity(enemy, goal.x, goal.y, 1, { nav, deltaMs });
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  if (enemyIsAttacking(enemy.combat)) {
    enemy.sprite.setVelocity(0, 0);
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  const bandSlack = worldUnit(22, reg);
  const preferred = worldUnit(tune.preferredRange, reg);
  const attackMax = worldUnit(tune.attackTriggerRange, reg);

  const targetX = desired === "player" ? playerX : goal.x;
  const targetY = desired === "player" ? playerY : goal.y;
  const dist = Math.hypot(targetX - ex, targetY - ey);

  if (desired === "wall") {
    const wallY = northWallAttackY();
    const distToWall = ey - wallY;
    if (distToWall < preferred - bandSlack) {
      applyDirectVelocity(enemy, 0, 1, 0.65);
    } else if (distToWall <= attackMax) {
      enemy.sprite.setVelocity(0, 0);
    } else {
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
      applyChaseVelocity(enemy, moveX, moveY, 0.9, { nav, deltaMs });
    }
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  if (dist < preferred - bandSlack) {
    applyDirectVelocity(enemy, ex - playerX, ey - playerY, 0.82);
  } else if (dist <= attackMax) {
    enemy.sprite.setVelocity(0, 0);
  } else {
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
    applyChaseVelocity(enemy, moveX, moveY, 0.9, { nav, deltaMs });
  }

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};