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

export type ArmedGroundPointerUp = "confirm" | "cancel" | "ignore";

/**
 * Pointer-up outcome for an armed ground spell.
 *
 * A press that started on the spell bar only places the spell after a drag
 * that is released in the play area. A short tap or long-press stays "ignore"
 * so the spell bar can auto-cast or cancel. Releasing back on the UI cancels.
 * A later pointer that started in the play area still confirms (click-to-place).
 */
export function resolveArmedGroundPointerUp(opts: {
  isAimGesture: boolean;
  fromUiBand: boolean;
  dragExceeded: boolean;
  releaseInPlayArea: boolean;
}): ArmedGroundPointerUp {
  if (!opts.isAimGesture) return "ignore";
  if (!opts.fromUiBand) return "confirm";
  if (opts.dragExceeded) {
    return opts.releaseInPlayArea ? "confirm" : "cancel";
  }
  return "ignore";
}
