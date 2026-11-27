import { worldUnit } from "../../config/worldScale";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import {
  pathingPeerAgents,
  wallPathingPlayerClearancePx,
} from "../brainShared";
import type { EnemyBehavior } from "./types";
import {
  applyChaseVelocity,
  applyDirectVelocity,
  setEnemyChaseVelocity,
} from "./movement";
import {
  beginBehaviorFrame,
  followPlannedPath,
  frameResult,
  pathReplanDue,
  replanPathIfDue,
} from "./rangedKite";
import { applyRetreatPathing } from "./retreatPathing";

export const lobberBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAgents } = ctx;
  const lob = enemy.combatTuning.lobber;
  const frame = beginBehaviorFrame(ctx);
  const { ex, ey, reg, waypointRadius, desired, goal } = frame;

  if (pathReplanDue(nav)) {
    // Peer list is only built when a replan actually happens.
    replanPathIfDue(
      ctx,
      frame,
      pathingPeerAgents(
        peerAgents,
        desired,
        playerX,
        playerY,
        wallPathingPlayerClearancePx(reg),
      ),
    );
  }

  if (!lob) {
    applyChaseVelocity(enemy, goal.x, goal.y, 1, { nav, deltaMs });
    return frameResult(frame);
  }

  const targetX = desired === "player" ? playerX : goal.x;
  const targetY = desired === "player" ? playerY : goal.y;
  const dist = Math.hypot(targetX - ex, targetY - ey);
  const bandSlack = worldUnit(lob.kiteBandSlackWu, reg);
  const preferred = worldUnit(lob.preferredRangeWu, reg);
  const attackMax = worldUnit(lob.attackTriggerRangeWu, reg);

  // Mid-throw: never retreat or chase — the lob telegraph is already planted.
  // In attack range, creep toward the target at `attackCreepSpeedMul` (0 = still).
  // This creep uses only that multiplier, not `attackMovement`, so one knob
  // turns the formerly-dead 0.35 drift on or off.
  if (enemyIsAttacking(enemy.combat)) {
    const creepMul = lob.attackCreepSpeedMul;
    if (dist <= attackMax && creepMul > 0) {
      applyDirectVelocity(enemy, targetX - ex, targetY - ey, creepMul, {
        phaseScale: 1,
      });
    } else {
      setEnemyChaseVelocity(enemy, 0, 0);
    }
    return frameResult(frame);
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
        desired,
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
    return frameResult(frame);
  } else if (dist <= attackMax) {
    setEnemyChaseVelocity(enemy, 0, 0);
  } else {
    followPlannedPath(ctx, frame, 0.9);
  }

  return frameResult(frame);
};
