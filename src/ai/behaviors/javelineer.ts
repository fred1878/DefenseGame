import { DEFENSE_MAP, JAVELINEER_TUNING } from "../../config";
import {
  pickEnemyTarget,
  replanEnemyPath,
  wallTargetPoint,
} from "../EnemyBrain";
import type { EnemyInstance } from "../../entities/Enemy";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, applyDirectVelocity } from "./movement";

function advanceStrafeSign(enemy: EnemyInstance, deltaMs: number): 1 | -1 {
  enemy.behaviorExtra.strafeFlipMs = Math.max(
    0,
    enemy.behaviorExtra.strafeFlipMs - deltaMs,
  );
  if (enemy.behaviorExtra.strafeFlipMs <= 0) {
    enemy.behaviorExtra.strafeSign =
      enemy.behaviorExtra.strafeSign === 1 ? -1 : 1;
    enemy.behaviorExtra.strafeFlipMs = JAVELINEER_TUNING.orbitFlipMs;
  }
  return enemy.behaviorExtra.strafeSign;
}

export const javelineerBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const desired = pickEnemyTarget(grid, ex, ey, playerX, playerY);
  nav.targetKind = desired;
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal =
    desired === "player"
      ? { x: playerX, y: playerY }
      : wallTargetPoint(ex, ey);

  if (nav.replanMs <= 0 || nav.path.length === 0) {
    replanEnemyPath(nav, grid, ex, ey, goal.x, goal.y);
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  const dx = playerX - ex;
  const dy = playerY - ey;
  const dist = Math.hypot(dx, dy);

  if (desired === "player") {
    const { minRange, maxRange } = JAVELINEER_TUNING;
    if (dist < minRange) {
      applyDirectVelocity(enemy, ex - playerX, ey - playerY, 1.05);
    } else if (dist > maxRange) {
      let moveX = goal.x;
      let moveY = goal.y;
      if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
        const wp = nav.path[nav.pathIndex]!;
        const d = Math.hypot(wp.x - ex, wp.y - ey);
        if (d <= DEFENSE_MAP.pathWaypointRadius) {
          nav.pathIndex += 1;
        }
        const nextWp = nav.path[nav.pathIndex];
        if (nextWp) {
          moveX = nextWp.x;
          moveY = nextWp.y;
        }
      }
      applyChaseVelocity(enemy, moveX, moveY, 1.08);
    } else {
      const sign = advanceStrafeSign(enemy, deltaMs);
      const len = dist || 1;
      const nx = dx / len;
      const ny = dy / len;
      const px = -ny * sign;
      const py = nx * sign;
      applyDirectVelocity(
        enemy,
        px + nx * 0.15,
        py + ny * 0.15,
        JAVELINEER_TUNING.strafeSpeedMul,
      );
    }
  } else {
    let moveX = goal.x;
    let moveY = goal.y;
    if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
      const wp = nav.path[nav.pathIndex]!;
      const d = Math.hypot(wp.x - ex, wp.y - ey);
      if (d <= DEFENSE_MAP.pathWaypointRadius) {
        nav.pathIndex += 1;
      }
      const nextWp = nav.path[nav.pathIndex];
      if (nextWp) {
        moveX = nextWp.x;
        moveY = nextWp.y;
      }
    }
    applyChaseVelocity(enemy, moveX, moveY, 1);
  }

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};