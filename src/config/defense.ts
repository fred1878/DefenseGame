import {
  GROUND_TILE_SIZE,
  OBSTACLE_BLOCKER_FOOTPRINT,
  OBSTACLE_SPRITE_CROP,
  type ObstacleTextureKey,
} from "../content/assets";
import { NORTH_WALL_MELEE_STANDOFF_WU } from "./enemy";
import { worldDisplayPx, worldScaleFactor, worldUnit } from "./worldScale";
import type Phaser from "phaser";

/** Playable defense footprint in 64px ground tiles (set from `defense-maps.json` at Boot). */
export let DEFENSE_FIELD_TILES: { cols: number; rows: number } = {
  cols: 0,
  rows: 0,
};

export function assertDefenseFieldLoaded(): void {
  if (DEFENSE_FIELD_TILES.cols < 1 || DEFENSE_FIELD_TILES.rows < 1) {
    throw new Error(
      "DEFENSE_FIELD_TILES not loaded — Boot must apply public/data/defense-maps.json",
    );
  }
}

/** Ground tile edge length in world px for the active debug world scale (64 at default 2×). */
export function defenseGroundTileStep(
  registry?: Phaser.Data.DataManager,
): number {
  return registry
    ? worldDisplayPx(GROUND_TILE_SIZE, registry)
    : GROUND_TILE_SIZE;
}

export function defenseFieldPx(registry?: Phaser.Data.DataManager): {
  width: number;
  height: number;
} {
  assertDefenseFieldLoaded();
  const step = defenseGroundTileStep(registry);
  return {
    width: DEFENSE_FIELD_TILES.cols * step,
    height: DEFENSE_FIELD_TILES.rows * step,
  };
}

/** @deprecated Prefer {@link defenseFieldPx} when field size may change per map. */
export const DEFENSE_FIELD_PX = {
  get width() {
    return defenseFieldPx().width;
  },
  get height() {
    return defenseFieldPx().height;
  },
};

export function defenseHalfWidth(registry?: Phaser.Data.DataManager): number {
  return defenseFieldPx(registry).width / 2;
}

export function defenseHalfHeight(registry?: Phaser.Data.DataManager): number {
  return defenseFieldPx(registry).height / 2;
}

/** North settlement wall — attack target plane (world y). */
export function northWallAttackY(registry?: Phaser.Data.DataManager): number {
  const half = defenseHalfHeight(registry);
  const inset = registry ? worldUnit(20, registry) : 20;
  return -half + inset + inset;
}

/**
 * Pathing stop line south of the wall so enemies hold attack range instead of walking into the barricade.
 */
export function northWallApproachY(
  registry?: Phaser.Data.DataManager,
  standoffWu = NORTH_WALL_MELEE_STANDOFF_WU,
): number {
  const standoffPx = registry ? worldUnit(standoffWu, registry) : standoffWu;
  return northWallAttackY(registry) + standoffPx;
}

/** Center of a ground tile in world space (same layout as `buildGroundLayer`). */
export function defenseTileCenter(
  tileX: number,
  tileY: number,
  registry?: Phaser.Data.DataManager,
): {
  x: number;
  y: number;
} {
  const step = defenseGroundTileStep(registry);
  const originX = -defenseHalfWidth(registry);
  const originY = -defenseHalfHeight(registry);
  return {
    x: originX + tileX * step + step / 2,
    y: originY + tileY * step + step / 2,
  };
}

/** On-field scale for defense obstacle sprites and matching nav/physics blockers. */
export const DEFENSE_OBSTACLE_WORLD_SCALE = 2;

/** Cosmetic-only shift for obstacle art (world px); blockers and nav use the anchor. */
export const DEFENSE_OBSTACLE_SPRITE_VISUAL_Y_OFFSET = 6;

/** Uniform shrink vs authored blocker footprints (tighter than transparent crop halo). */
export const OBSTACLE_COLLIDER_SIZE_SCALE = 0.8;

export type ObstaclePhysicsLayout = {
  bodyW: number;
  bodyH: number;
  displayW: number;
  displayH: number;
  /**
   * Collider center offset from the sprite anchor (origin 0.5 at crop center).
   * Positive Y moves the body south — feet align to the crop baseline.
   */
  bodyCenterOffsetX: number;
  bodyCenterOffsetY: number;
};

/** Gameplay blocker footprint (nav grid + Arcade body), tighter than sprite crop. */
export function obstaclePhysicsLayout(
  textureKey: ObstacleTextureKey,
  registry?: Phaser.Data.DataManager,
): ObstaclePhysicsLayout {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  const block = OBSTACLE_BLOCKER_FOOTPRINT[textureKey];
  const s =
    DEFENSE_OBSTACLE_WORLD_SCALE * (registry ? worldScaleFactor(registry) : 1);
  const bodyW = Math.min(block.w, crop.w) * s * OBSTACLE_COLLIDER_SIZE_SCALE;
  const bodyH = Math.min(block.h, crop.h) * s * OBSTACLE_COLLIDER_SIZE_SCALE;
  const displayW = crop.w * s;
  const displayH = crop.h * s;
  return {
    bodyW,
    bodyH,
    displayW,
    displayH,
    bodyCenterOffsetX: 0,
    bodyCenterOffsetY: (displayH - bodyH) / 2,
  };
}

export function obstacleDisplaySize(
  textureKey: ObstacleTextureKey,
  registry?: Phaser.Data.DataManager,
): {
  w: number;
  h: number;
} {
  const layout = obstaclePhysicsLayout(textureKey, registry);
  return { w: layout.displayW, h: layout.displayH };
}

export const DEFENSE_MAP = {
  /** 16px nav cells — quarter ground tile — so blocked cells hug sprite mass. */
  cellSize: 16,
  /** How close an enemy must be to a path node before advancing. */
  pathWaypointRadius: 14,
  /** Recompute A* at most this often per enemy (ms). */
  pathReplanMs: 450,
  /** No meaningful progress toward the current waypoint for this long → emergency replan. */
  pathStallMs: 400,
};

export type DefenseObstacleRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  textureKey: ObstacleTextureKey;
};

export type DefenseObstaclePlacement = {
  tileX: number;
  tileY: number;
  textureKey: ObstacleTextureKey;
};

/** Tile placements from `defense-maps.json` (empty until Boot). */
export let DEFENSE_OBSTACLE_PLACEMENTS: DefenseObstaclePlacement[] = [];

export function defenseObstacleSpriteAnchor(
  placement: DefenseObstaclePlacement,
  registry?: Phaser.Data.DataManager,
): { x: number; y: number } {
  const tile = defenseTileCenter(placement.tileX, placement.tileY, registry);
  const { displayH } = obstaclePhysicsLayout(placement.textureKey, registry);
  return {
    x: tile.x,
    y: tile.y - displayH / 2,
  };
}

/** Screen position for obstacle `Image` sprites — anchor plus cosmetic Y only. */
export function defenseObstacleSpriteDisplayPosition(
  placement: DefenseObstaclePlacement,
  registry?: Phaser.Data.DataManager,
): { x: number; y: number } {
  const anchor = defenseObstacleSpriteAnchor(placement, registry);
  const yOff = registry
    ? worldUnit(DEFENSE_OBSTACLE_SPRITE_VISUAL_Y_OFFSET, registry)
    : DEFENSE_OBSTACLE_SPRITE_VISUAL_Y_OFFSET;
  return {
    x: anchor.x,
    y: anchor.y + yOff,
  };
}

export function defenseObstacleColliderFromPlacement(
  placement: DefenseObstaclePlacement,
  registry?: Phaser.Data.DataManager,
): DefenseObstacleRect {
  const anchor = defenseObstacleSpriteAnchor(placement, registry);
  const layout = obstaclePhysicsLayout(placement.textureKey, registry);
  return {
    x: anchor.x + layout.bodyCenterOffsetX,
    y: anchor.y + layout.bodyCenterOffsetY,
    w: layout.bodyW,
    h: layout.bodyH,
    textureKey: placement.textureKey,
  };
}

/** Static rock/wall blockers (world coords = Arcade body AABB center + size). */
export let DEFENSE_OBSTACLES: DefenseObstacleRect[] = [];

function refreshDefenseObstacleColliders(): void {
  DEFENSE_OBSTACLES = DEFENSE_OBSTACLE_PLACEMENTS.map((p) =>
    defenseObstacleColliderFromPlacement(p),
  );
}

/** Apply field footprint + obstacles from `public/data/defense-maps.json`. */
export function applyDefenseMapLayout(
  field: { cols: number; rows: number },
  obstacles: DefenseObstaclePlacement[],
): void {
  DEFENSE_FIELD_TILES = { ...field };
  DEFENSE_OBSTACLE_PLACEMENTS = obstacles.map((p) => ({ ...p }));
  refreshDefenseObstacleColliders();
}
