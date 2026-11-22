import { DEFENSE_MAP, PLAYER_AGGRO_RADIUS } from "../../config";
import { playerAggroRadiusWu } from "../../config/shadowformRuntime";
import { worldUnit } from "../../core/worldPixelScale";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import {
  pathingPeerAgents,
  replanEnemyPath,
  resolveEnemyTarget,
  wallPathingPlayerClearancePx,
} from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, applyDirectVelocity, setEnemyChaseVelocity } from "./movement";
import { applyRetreatPathing } from "./retreatPathing";

export const lobberBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAgents } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene.registry;
  const waypointRadius = worldUnit(DEFENSE_MAP.pathWaypointRadius, reg);
  const lob = enemy.combatTuning.lobber;
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

  if (nav.replanMs <= 0 || nav.path.length === 0) {
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
        wallPathingPlayerClearancePx(enemy.sprite.scene.registry),
      ),
      enemy,
    );
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  if (!lob) {
    applyChaseVelocity(enemy, goal.x, goal.y, 1, { nav, deltaMs });
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  const targetX = desired === "player" ? playerX : goal.x;
  const targetY = desired === "player" ? playerY : goal.y;
  const dist = Math.hypot(targetX - ex, targetY - ey);
  const bandSlack = worldUnit(lob.kiteBandSlackWu, reg);
  const preferred = worldUnit(lob.preferredRangeWu, reg);
  const attackMax = worldUnit(lob.attackTriggerRangeWu, reg);

  if (enemyIsAttacking(enemy.combat)) {
    setEnemyChaseVelocity(enemy, 0, 0);
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  }

  if (dist < preferred - bandSlack) {
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: targetX,
      threatY: targetY,
      deltaMs,
      waypointRadius,
      peerAgents: pathingPeerAgents(
        peerAgents,
        resolved.targetKind,
        playerX,
        playerY,
        wallPathingPlayerClearancePx(reg),
      ),
      speedMul: 0.78,
      retreatGoalDistPx: Math.max(
        worldUnit(64, reg),
        preferred - dist + bandSlack,
      ),
    });
    return { targetX: goal.x, targetY: goal.y, targetKind: desired };
  } else if (dist <= attackMax) {
    if (enemy.combat.phase === "idle") {
      setEnemyChaseVelocity(enemy, 0, 0);
    } else {
      applyDirectVelocity(enemy, targetX - ex, targetY - ey, 0.35);
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
    applyChaseVelocity(enemy, moveX, moveY, 0.9, { nav, deltaMs });
  }

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};