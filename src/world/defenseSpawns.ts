import Phaser from "phaser";
import { defenseHalfHeight, defenseHalfWidth } from "../config/defense";
import { worldUnit } from "../config/worldScale";

/** South band where night waves enter (north = negative y). */
export function pickWaveSpawnPoint(
  e2e: boolean,
  registry?: Phaser.Data.DataManager,
): { x: number; y: number } {
  const halfW = defenseHalfWidth(registry);
  const halfH = defenseHalfHeight(registry);
  const marginX = registry ? worldUnit(36, registry) : 36;
  const southY = halfH - (registry ? worldUnit(96, registry) : 96);
  if (e2e) {
    return { x: 0, y: southY };
  }
  const jitterY = registry ? worldUnit(24, registry) : 24;
  return {
    x: Phaser.Math.Between(-halfW + marginX, halfW - marginX),
    y: Phaser.Math.Between(southY - jitterY, southY + jitterY),
  };
}

/** Player start — vertical center of the scrollable field (night + endless). */
export function defensePlayerStart(): { x: number; y: number } {
  return { x: 0, y: 0 };
}
