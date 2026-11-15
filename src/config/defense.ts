import {
  GROUND_TILE_SIZE,
  OBSTACLE_BLOCKER_FOOTPRINT,
  OBSTACLE_SPRITE_CROP,
  OBSTACLE_TEXTURE,
  type ObstacleTextureKey,
} from "../content/assets";
import { DEFAULT_WALL_COMBAT } from "../core/enemyTuning";

/** Playable defense footprint in 64px ground tiles (source of truth). */
export const DEFENSE_FIELD_TILES = {
  /** East–west — fewer columns than legacy square maps. */
  cols: 5,
  /** North–south — tall scrollable field (taller than 1200px viewport). */
  rows: 22,
} as const;

export const DEFENSE_FIELD_PX = {
  width: DEFENSE_FIELD_TILES.cols * GROUND_TILE_SIZE,
  height: DEFENSE_FIELD_TILES.rows * GROUND_TILE_SIZE,
} as const;

export function defenseHalfWidth(): number {
  return DEFENSE_FIELD_PX.width / 2;
}

export function defenseHalfHeight(): number {
  return DEFENSE_FIELD_PX.height / 2;
}

/** North settlement wall — attack target plane (world y). */
export function northWallAttackY(): number {
  const half = defenseHalfHeight();
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
  const originX = -defenseHalfWidth();
  const originY = -defenseHalfHeight();
  return {
    x: originX + tileX * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2,
    y: originY + tileY * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2,
  };
}

/** Gameplay blocker footprint (nav grid + Arcade body), tighter than sprite crop. */
export function obstacleColliderSize(textureKey: ObstacleTextureKey): {
  w: number;
  h: number;
} {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  const block = OBSTACLE_BLOCKER_FOOTPRINT[textureKey];
  return {
    w: Math.min(block.w, crop.w),
    h: Math.min(block.h, crop.h),
  };
}

export function obstacleDisplaySize(textureKey: ObstacleTextureKey): {
  w: number;
  h: number;
} {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  return { w: crop.w, h: crop.h };
}

export const DEFENSE_MAP = {
  /** 16px nav cells — quarter ground tile — so blocked cells hug sprite mass. */
  cellSize: 16,
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
  obsAtTile(1, 3, OBSTACLE_TEXTURE.wideSlab),
  obsAtTile(3, 4, OBSTACLE_TEXTURE.tallRock),
  obsAtTile(1, 15, OBSTACLE_TEXTURE.rubbleLow),
  obsAtTile(3, 16, OBSTACLE_TEXTURE.boulderSm),
  obsAtTile(2, 2, OBSTACLE_TEXTURE.boulderMed),
  obsAtTile(3, 11, OBSTACLE_TEXTURE.boulderSm),
  obsAtTile(1, 10, OBSTACLE_TEXTURE.boulderMed),
  obsAtTile(2, 8, OBSTACLE_TEXTURE.rubbleLow),
];