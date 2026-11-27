import type Phaser from "phaser";
import { GAME } from "../../config/game";
import {
  clampWorldPixelScale,
  getWorldPixelScale,
  WORLD_PIXEL_SCALE_CHANGED,
  WORLD_PIXEL_SCALE_REGISTRY_KEY,
} from "../../config/worldScale";

export function worldScaleDebugLabel(scale: number): string {
  return `World scale: ${scale}×`;
}

/** Session-only debug override; restarts an active Defense run so art and colliders rebuild. */
export function setDebugWorldPixelScale(
  game: Phaser.Game,
  value: number,
): number {
  const next = clampWorldPixelScale(value);
  game.registry.set(WORLD_PIXEL_SCALE_REGISTRY_KEY, next);
  game.events.emit(WORLD_PIXEL_SCALE_CHANGED, next);
  const defense = game.scene.getScene("Defense");
  if (defense?.scene.isActive()) {
    defense.scene.restart();
  }
  return next;
}

export function cycleDebugWorldPixelScale(game: Phaser.Game): number {
  const cur = getWorldPixelScale(game.registry);
  const next = cur >= GAME.renderResolutionCap ? 1 : cur + 1;
  return setDebugWorldPixelScale(game, next);
}
