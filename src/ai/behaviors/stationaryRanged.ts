import { DEFENSE_MAP, northWallAttackY, PLAYER_AGGRO_RADIUS } from "../../config";
import { playerAggroRadiusWu } from "../../config/shadowformRuntime";
import { worldUnit } from "../../core/worldPixelScale";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, setEnemyChaseVelocity } from "./movement";
import { applyRetreatPathing } from "./retreatPathing";

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
    worldUnit(playerAggroRadiusWu(PLAYER_AGGRO_RADIUS), reg),
    ctx.objective ?? "defendWall",
    reg,
  );
  const desired = resolved.targetKind;
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal = { x: resolved.goalX, y: resolved.goalY };

  const tune = enemy.combatTuning.stationaryRanged;
  if (!tune) {
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
    applyChaseVelocity(enemy, goal.x, goal.y, 1, { nav, deltaMs });
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  if (enemyIsAttacking(enemy.combat)) {
    setEnemyChaseVelocity(enemy, 0, 0);
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  const bandSlack = worldUnit(tune.kiteBandSlackWu, reg);
  const preferred = worldUnit(tune.preferredRangeWu, reg);
  const attackMax = worldUnit(tune.attackTriggerRangeWu, reg);

  const targetX = desired === "player" ? playerX : goal.x;
  const targetY = desired === "player" ? playerY : goal.y;
  const dist = Math.hypot(targetX - ex, targetY - ey);

  if (desired === "wall") {
    const wallY = northWallAttackY();
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
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: playerX,
      threatY: playerY,
      deltaMs,
      waypointRadius,
      peerAgents,
      speedMul: 0.82,
      retreatGoalDistPx: Math.max(
        worldUnit(64, reg),
        preferred - dist + bandSlack,
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

  if (dist <= attackMax) {
    setEnemyChaseVelocity(enemy, 0, 0);
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