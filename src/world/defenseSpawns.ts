import Phaser from "phaser";
import { defenseHalfHeight, defenseHalfWidth } from "../config/defense";

/** South band where night waves enter (north = negative y). */
export function pickWaveSpawnPoint(e2e: boolean): { x: number; y: number } {
  const halfW = defenseHalfWidth();
  const halfH = defenseHalfHeight();
  const marginX = 36;
  const southY = halfH - 96;
  if (e2e) {
    return { x: 0, y: southY };
  }
  return {
    x: Phaser.Math.Between(-halfW + marginX, halfW - marginX),
    y: Phaser.Math.Between(southY - 24, southY + 24),
  };
}

/** Player start — mid-south, room to kite north toward the wall. */
export function defensePlayerStart(): { x: number; y: number } {
  const halfH = defenseHalfHeight();
  return { x: 0, y: halfH - 220 };
}