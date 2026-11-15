import { DEFENSE_MAP } from "../../config";
import {
  pickEnemyTarget,
  replanEnemyPath,
  wallTargetPoint,
} from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity } from "./movement";

export const meleeChaserBehavior: EnemyBehavior = (ctx) => {
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

  return { targetX: goal.x, targetY: goal.y, targetKind: desired };
};