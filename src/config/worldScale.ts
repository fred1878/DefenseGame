import type Phaser from "phaser";
import { GAME } from "./game";

/**
 * World pixel scale: pure lookups shared by config, gameplay and rendering.
 * Debug setters that restart scenes live in `core/render/worldPixelScale.ts`.
 */
export const WORLD_PIXEL_SCALE_REGISTRY_KEY = "worldPixelScale";
export const WORLD_PIXEL_SCALE_CHANGED = "world-pixel-scale-changed";

/** On-screen world art at 2× source pixels (matches `SPRITE_DISPLAY` / `GROUND_TILE_SIZE` today). */
export const DEFAULT_WORLD_PIXEL_SCALE = 2;

export function clampWorldPixelScale(
  value: number,
  max = GAME.renderResolutionCap,
): number {
  return Math.min(Math.max(Math.round(value), 1), max);
}

export function getWorldPixelScale(registry: Phaser.Data.DataManager): number {
  const stored = registry.get(WORLD_PIXEL_SCALE_REGISTRY_KEY) as
    | number
    | undefined;
  if (stored !== undefined) return clampWorldPixelScale(stored);
  return DEFAULT_WORLD_PIXEL_SCALE;
}

/** Multiplier vs today's default world sizing (1 → half size, 3 → 1.5×). */
export function worldScaleFactor(registry: Phaser.Data.DataManager): number {
  return getWorldPixelScale(registry) / DEFAULT_WORLD_PIXEL_SCALE;
}

/** Scale a world-space length from the current 2× baseline layout. */
export function worldUnit(
  atDefault2x: number,
  registry: Phaser.Data.DataManager,
): number {
  return atDefault2x * worldScaleFactor(registry);
}

/** On-screen pixel size for sprites/tiles authored at 2× source baseline. */
export function worldDisplayPx(
  atDefault2x: number,
  registry: Phaser.Data.DataManager,
): number {
  return worldUnit(atDefault2x, registry);
}
