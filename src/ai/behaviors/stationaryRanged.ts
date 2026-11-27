import { tuning } from "../../tuning/gameTuning";
import { northWallAttackY } from "../../config";
import { worldUnit } from "../../config/worldScale";
import type { EnemyBehavior } from "./types";
import { applyChaseVelocity } from "./movement";
import {
  applyKiteBand,
  beginBehaviorFrame,
  frameResult,
  replanPathIfDue,
} from "./rangedKite";

export const stationaryRangedBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, playerX, playerY, deltaMs } = ctx;
  const frame = beginBehaviorFrame(ctx);
  const { ex, ey, reg, desired, goal } = frame;

  const tune = enemy.combatTuning.stationaryRanged;
  if (!tune) {
    replanPathIfDue(ctx, frame);
    applyChaseVelocity(enemy, goal.x, goal.y, 1, { nav, deltaMs });
    return frameResult(frame);
  }

  const move = tuning("enemyAi").stationaryRanged;
  const bandSlack = worldUnit(tune.kiteBandSlackWu, reg);
  const preferred = worldUnit(tune.preferredRangeWu, reg);
  const attackMax = worldUnit(tune.attackTriggerRangeWu, reg);

  if (desired === "wall") {
    const wallY = northWallAttackY(reg);
    return applyKiteBand(ctx, frame, {
      dist: ey - wallY,
      preferred,
      bandSlack,
      attackMax,
      threatX: ex,
      threatY: wallY,
      retreatSpeedMul: move.wallRetreatSpeedMul,
      retreatMinWu: move.wallRetreatMinWu,
      followSpeedMul: move.followSpeedMul,
    });
  }

  return applyKiteBand(ctx, frame, {
    dist: Math.hypot(playerX - ex, playerY - ey),
    preferred,
    bandSlack,
    attackMax,
    threatX: playerX,
    threatY: playerY,
    retreatSpeedMul: move.playerRetreatSpeedMul,
    retreatMinWu: move.playerRetreatMinWu,
    followSpeedMul: move.followSpeedMul,
  });
};
