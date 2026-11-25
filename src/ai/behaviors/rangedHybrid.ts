import { worldUnit } from "../../core/worldPixelScale";
import { enemyIsAttacking } from "../../entities/EnemyCombat";
import type { EnemyBehavior } from "./types";
import {
  applyChaseVelocity,
  playerChaseVelocityOpts,
  setEnemyChaseVelocity,
} from "./movement";
import {
  applyKiteBand,
  beginBehaviorFrame,
  followPlannedPath,
  frameResult,
  replanPathIfDue,
} from "./rangedKite";
import { applyRetreatPathing } from "./retreatPathing";

export const rangedHybridBehavior: EnemyBehavior = (ctx) => {
  const {
    enemy,
    nav,
    grid,
    playerX,
    playerY,
    deltaMs,
    peerAgents,
    peerAllies,
  } = ctx;
  const hybrid = enemy.combatTuning.hybrid;
  const ranged = enemy.combatTuning.stationaryRanged;
  const extra = enemy.rangedHybrid;
  const frame = beginBehaviorFrame(ctx);
  const { ex, ey, reg, waypointRadius, desired, goal } = frame;

  const targetX = desired === "player" ? playerX : goal.x;
  const targetY = desired === "player" ? playerY : goal.y;
  const dist = Math.hypot(targetX - ex, targetY - ey);

  const chasePlayer = (speedMul: number) =>
    applyChaseVelocity(
      enemy,
      playerX,
      playerY,
      speedMul,
      playerChaseVelocityOpts(enemy, {
        nav,
        deltaMs,
        targetKind: desired,
        playerX,
        playerY,
        peerAllies,
      }),
    );

  if (extra?.mode === "retreat" && desired === "player" && hybrid) {
    const preferred = worldUnit(hybrid.preferredRangeWu, reg);
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: targetX,
      threatY: targetY,
      deltaMs,
      waypointRadius,
      peerAgents,
      speedMul: 1.05,
      retreatGoalDistPx: Math.max(
        worldUnit(72, reg),
        preferred - dist + worldUnit(hybrid.retreatRangeSlackWu, reg),
      ),
    });
    return frameResult(frame);
  }

  if (enemyIsAttacking(enemy.combat) && extra?.mode !== "melee") {
    setEnemyChaseVelocity(enemy, 0, 0);
    return frameResult(frame);
  }

  if (extra?.mode === "melee" && desired === "player") {
    chasePlayer(1.08);
    return frameResult(frame);
  }

  if (extra?.mode === "ranged" && desired === "player" && hybrid && ranged) {
    const meleeEngage = worldUnit(
      enemy.combatTuning.melee!.triggerRangeWu,
      reg,
    );
    if (dist <= meleeEngage) {
      chasePlayer(1.05);
      return frameResult(frame);
    }
    return applyKiteBand(ctx, frame, {
      dist,
      preferred: worldUnit(hybrid.preferredRangeWu, reg),
      bandSlack: worldUnit(ranged.kiteBandSlackWu, reg),
      attackMax: worldUnit(ranged.attackTriggerRangeWu, reg),
      threatX: playerX,
      threatY: playerY,
      retreatSpeedMul: 0.88,
      retreatMinWu: 64,
      followSpeedMul: 0.92,
    });
  }

  replanPathIfDue(ctx, frame);
  followPlannedPath(ctx, frame, 1);
  return frameResult(frame);
};
