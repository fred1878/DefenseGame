import { tuning } from "../../tuning/gameTuning";
import { northWallAttackY } from "../../config";
import { worldUnit } from "../../config/worldScale";
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
  const move = tuning("enemyAi").arrowRainArcher;

  if (arrow) {
    const kite = {
      preferred: worldUnit(arrow.preferredRangeWu, reg),
      bandSlack: worldUnit(arrow.kiteBandSlackWu, reg),
      attackMax: worldUnit(arrow.attackTriggerRangeWu, reg),
      followSpeedMul: move.followSpeedMul,
    };
    if (desired === "player") {
      return applyKiteBand(ctx, frame, {
        ...kite,
        dist: Math.hypot(playerX - ex, playerY - ey),
        threatX: playerX,
        threatY: playerY,
        retreatSpeedMul: move.playerRetreatSpeedMul,
        retreatMinWu: move.playerRetreatMinWu,
      });
    }
    return applyKiteBand(ctx, frame, {
      ...kite,
      dist: ey - wallY,
      threatX: ex,
      threatY: wallY,
      retreatSpeedMul: move.wallRetreatSpeedMul,
      retreatMinWu: move.wallRetreatMinWu,
    });
  }

  replanPathIfDue(ctx, frame);
  followPlannedPath(ctx, frame, move.followSpeedMul);
  return frameResult(frame);
};
