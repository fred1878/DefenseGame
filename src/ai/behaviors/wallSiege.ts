import { DEFENSE_MAP, PLAYER_AGGRO_RADIUS } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import { replanEnemyPath, resolveEnemyTarget } from "../EnemyBrain";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity } from "./movement";

/** Paths to the north wall; only chases when the player is very close. */
export const wallSiegeBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAgents } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene.registry;
  const waypointRadius = worldUnit(DEFENSE_MAP.pathWaypointRadius, reg);
  const siege = enemy.combatTuning.wallSiege;
  const aggro =
    siege?.playerAggroRadius ?? PLAYER_AGGRO_RADIUS;
  const resolved = resolveEnemyTarget(
    nav,
    grid,
    ex,
    ey,
    playerX,
    playerY,
    deltaMs,
    worldUnit(aggro, reg),
  );
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
    );
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

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

  applyChaseVelocity(enemy, moveX, moveY, 1, { nav, deltaMs });

  return { targetX: goal.x, targetY: goal.y, targetKind: resolved.targetKind };
};