import { clampGroundTarget } from "../../combat/spellMechanics";
import type { DefensePlayArea } from "../../ui/screenLayout";

export function pointerInDefensePlayArea(
  screenX: number,
  screenY: number,
  playArea: DefensePlayArea,
): boolean {
  return (
    screenX >= playArea.x &&
    screenX <= playArea.x + playArea.width &&
    screenY >= playArea.y &&
    screenY <= playArea.y + playArea.height
  );
}

/** World aim for a manual ground spell from a world-space point (clamped to max range). */
export function groundAimFromWorldPoint(
  playerX: number,
  playerY: number,
  worldX: number,
  worldY: number,
  maxRangeWu: number,
): { x: number; y: number } {
  return clampGroundTarget(playerX, playerY, worldX, worldY, maxRangeWu);
}