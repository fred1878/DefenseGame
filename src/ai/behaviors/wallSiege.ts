import {
  chaseToward,
  nextPathMoveTarget,
  replanApproachPathIfDue,
} from "./shared/pathApproach";
import { tuning } from "../../tuning/gameTuning";
import { DEFENSE_MAP } from "../../config";
import { playerAggroRadiusWu } from "../../combat/rules/shadowformRuntime";
import { worldUnit } from "../../config/worldScale";
import { resolveEnemyTarget } from "../brainShared";
import type { EnemyBehavior } from "./types";
import { applyWallMeleeHold, shouldHoldAtWallMelee } from "./movement";

/** Paths to the north wall; only chases when the player is very close. */
export const wallSiegeBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene.registry;
  const waypointRadius = worldUnit(DEFENSE_MAP.pathWaypointRadius, reg);
  const siege = enemy.combatTuning.wallSiege;
  const aggro = playerAggroRadiusWu(
    siege?.playerAggroRadiusWu ?? tuning("enemyAi").playerAggroRadiusWu,
  );
  const resolved = resolveEnemyTarget(
    nav,
    grid,
    ex,
    ey,
    playerX,
    playerY,
    deltaMs,
    worldUnit(aggro, reg),
    ctx.objective ?? "defendWall",
    reg,
  );
  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const goal = { x: resolved.goalX, y: resolved.goalY };
  const holdAtWall = shouldHoldAtWallMelee(enemy, resolved.targetKind);

  if (!holdAtWall) {
    replanApproachPathIfDue(
      ctx,
      ex,
      ey,
      goal.x,
      goal.y,
      resolved.targetKind,
      waypointRadius,
    );
  }

  if (holdAtWall) {
    applyWallMeleeHold(enemy);
    return {
      targetX: goal.x,
      targetY: goal.y,
      targetKind: resolved.targetKind,
    };
  }

  const move = nextPathMoveTarget(nav, ex, ey, goal.x, goal.y, waypointRadius);
  chaseToward(ctx, move, 1, resolved.targetKind);

  return { targetX: goal.x, targetY: goal.y, targetKind: resolved.targetKind };
};
