import { tuning } from "../../tuning/gameTuning";
import { worldUnit } from "../../config/worldScale";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity, playerChaseVelocityOpts } from "./movement";
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

  const move = tuning("enemyAi").rangedHybrid;
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
      speedMul: move.retreatSpeedMul,
      retreatGoalDistPx: Math.max(
        worldUnit(move.retreatMinWu, reg),
        preferred - dist + worldUnit(hybrid.retreatRangeSlackWu, reg),
      ),
    });
    return frameResult(frame);
  }

  if (extra?.mode === "melee" && desired === "player") {
    chasePlayer(move.meleeChaseSpeedMul);
    return frameResult(frame);
  }

  if (extra?.mode === "ranged" && desired === "player" && hybrid && ranged) {
    const meleeEngage = worldUnit(
      enemy.combatTuning.melee!.triggerRangeWu,
      reg,
    );
    if (dist <= meleeEngage) {
      chasePlayer(move.closeChaseSpeedMul);
      return frameResult(frame);
    }
    return applyKiteBand(ctx, frame, {
      dist,
      preferred: worldUnit(hybrid.preferredRangeWu, reg),
      bandSlack: worldUnit(ranged.kiteBandSlackWu, reg),
      attackMax: worldUnit(ranged.attackTriggerRangeWu, reg),
      threatX: playerX,
      threatY: playerY,
      retreatSpeedMul: move.kiteRetreatSpeedMul,
      retreatMinWu: move.kiteRetreatMinWu,
      followSpeedMul: move.kiteFollowSpeedMul,
    });
  }

  replanPathIfDue(ctx, frame);
  followPlannedPath(ctx, frame, 1);
  return frameResult(frame);
};
