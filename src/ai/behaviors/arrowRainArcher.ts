import { northWallAttackY } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import type { EnemyBehavior } from "./types";
import {
  applyKiteBand,
  beginBehaviorFrame,
  followPlannedPath,
  frameResult,
  replanPathIfDue,
} from "./rangedKite";

export const arrowRainArcherBehavior: EnemyBehavior = (ctx) => {
  const { enemy, playerX, playerY } = ctx;
  const frame = beginBehaviorFrame(ctx);
  const { ex, ey, reg, desired } = frame;
  const arrow = enemy.combatTuning.arrowRain;
  const wallY = northWallAttackY(reg);

  if (arrow) {
    const kite = {
      preferred: worldUnit(arrow.preferredRangeWu, reg),
      bandSlack: worldUnit(arrow.kiteBandSlackWu, reg),
      attackMax: worldUnit(arrow.attackTriggerRangeWu, reg),
      followSpeedMul: 0.92,
    };
    if (desired === "player") {
      return applyKiteBand(ctx, frame, {
        ...kite,
        dist: Math.hypot(playerX - ex, playerY - ey),
        threatX: playerX,
        threatY: playerY,
        retreatSpeedMul: 0.85,
        retreatMinWu: 64,
      });
    }
    return applyKiteBand(ctx, frame, {
      ...kite,
      dist: ey - wallY,
      threatX: ex,
      threatY: wallY,
      retreatSpeedMul: 0.65,
      retreatMinWu: 56,
    });
  }

  replanPathIfDue(ctx, frame);
  followPlannedPath(ctx, frame, 0.92);
  return frameResult(frame);
};
