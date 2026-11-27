import { tuning } from "../tuning/gameTuning";
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
  const band = tuning("gameplay").spawn;
  const wu = (v: number) => (registry ? worldUnit(v, registry) : v);
  const marginX = wu(band.marginXWu);
  const southY = halfH - wu(band.southInsetWu);
  if (e2e) {
    return { x: 0, y: southY };
  }
  const jitterY = wu(band.jitterYWu);
  return {
    x: Phaser.Math.Between(-halfW + marginX, halfW - marginX),
    y: Phaser.Math.Between(southY - jitterY, southY + jitterY),
  };
}

/** Player start — vertical center of the scrollable field (night + endless). */
export function defensePlayerStart(): { x: number; y: number } {
  return { x: 0, y: 0 };
}
