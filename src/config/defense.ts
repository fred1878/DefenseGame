import {
  GROUND_TILE_SIZE,
  OBSTACLE_SPRITE_CROP,
  OBSTACLE_TEXTURE,
  type ObstacleTextureKey,
} from "../content/assets";
import { DEFAULT_WALL_COMBAT } from "../core/enemyTuning";
import { GAME } from "./game";

/** North settlement wall — attack target plane (world y). */
export function northWallAttackY(): number {
  const half = GAME.worldHalfHeight;
  return -half + 20 + 20;
}

/**
 * Pathing stop line south of the wall so enemies hold attack range instead of walking into the barricade.
 */
export function northWallApproachY(
  standoffPx = DEFAULT_WALL_COMBAT.triggerRange - 6,
): number {
  return northWallAttackY() + standoffPx;
}

/** Center of a ground tile in world space (same layout as `buildGroundLayer`). */
export function defenseTileCenter(tileX: number, tileY: number): {
  x: number;
  y: number;
} {
  const originX = -GAME.worldHalfWidth;
  const originY = -GAME.worldHalfHeight;
  return {
    x: originX + tileX * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2,
    y: originY + tileY * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2,
  };
}

/** Gameplay collider footprint — matches cropped opaque art at 1:1 (see `configureDefenseObstacleSprite`). */
export function obstacleColliderSize(textureKey: ObstacleTextureKey): {
  w: number;
  h: number;
} {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  return { w: crop.w, h: crop.h };
}

export const DEFENSE_MAP = {
  cellSize: 40,
  /** How close an enemy must be to a path node before advancing. */
  pathWaypointRadius: 14,
  /** Recompute A* at most this often per enemy (ms). */
  pathReplanMs: 450,
} as const;

export type DefenseObstacleRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  textureKey: ObstacleTextureKey;
};

function obsAtTile(
  tileX: number,
  tileY: number,
  textureKey: ObstacleTextureKey,
): DefenseObstacleRect {
  const { x, y } = defenseTileCenter(tileX, tileY);
  const { w, h } = obstacleColliderSize(textureKey);
  return { x, y, w, h, textureKey };
}

/** Static rock/wall blocks on the defense field (world coords, center origin). */
export const DEFENSE_OBSTACLES: DefenseObstacleRect[] = [
  obsAtTile(1, 4, OBSTACLE_TEXTURE.wideSlab),
  obsAtTile(4, 5, OBSTACLE_TEXTURE.tallRock),
  obsAtTile(1, 14, OBSTACLE_TEXTURE.rubbleLow),
  obsAtTile(4, 15, OBSTACLE_TEXTURE.boulderSm),
  obsAtTile(2, 2, OBSTACLE_TEXTURE.boulderMed),
  obsAtTile(3, 10, OBSTACLE_TEXTURE.boulderSm),
  obsAtTile(1, 11, OBSTACLE_TEXTURE.boulderMed),
  obsAtTile(2, 7, OBSTACLE_TEXTURE.rubbleLow),
];

/** Full playable defense footprint in world px (east-west × north-south). */
export const DEFENSE_FIELD_SIZE = {
  width: GAME.worldHalfWidth * 2,
  height: GAME.worldHalfHeight * 2,
} as const;