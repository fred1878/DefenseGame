import { DEFENSE_MAP } from "../../config";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, applyDirectVelocity } from "./movement";

export const arrowRainArcherBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const resolved = resolveEnemyTarget(nav, grid, ex, ey, playerX, playerY, deltaMs);
  const desired = resolved.targetKind;
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal = { x: resolved.goalX, y: resolved.goalY };

  if (nav.replanMs <= 0 || nav.path.length === 0) {
    replanEnemyPath(nav, grid, ex, ey, goal.x, goal.y);
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  const distToPlayer = Math.hypot(playerX - ex, playerY - ey);
  const arrow = enemy.combatTuning.arrowRain;
  const inAttackBand =
    desired === "player" &&
    arrow !== undefined &&
    distToPlayer <= arrow.attackTriggerRange;

  if (inAttackBand && arrow) {
    const tooClose = distToPlayer < arrow.preferredRange - 24;
    if (tooClose) {
      applyDirectVelocity(enemy, ex - playerX, ey - playerY, 0.65);
    } else {
      enemy.sprite.setVelocity(0, 0);
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
    applyChaseVelocity(enemy, moveX, moveY, 0.92, { nav, deltaMs });
  }

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};