import {
  GROUND_TILE_SIZE,
  OBSTACLE_BLOCKER_FOOTPRINT,
  OBSTACLE_SPRITE_CROP,
  OBSTACLE_TEXTURE,
  type ObstacleTextureKey,
} from "../content/assets";
import {
  DEFAULT_WALL_COMBAT,
  wallMeleeApproachStandoffPx,
} from "../core/enemyTuning";
import { maxNavObstacleClearancePx } from "../entities/entityPhysics";

/** Playable defense footprint in 64px ground tiles (source of truth; mutable after Boot). */
export let DEFENSE_FIELD_TILES: { cols: number; rows: number } = {
  /** East–west — ~1.5× portrait viewport (540px → 832px @ 13×64). */
  cols: 13,
  /** North–south — tall scrollable field (taller than 1200px viewport). */
  rows: 22,
};

export function defenseFieldPx(): { width: number; height: number } {
  return {
    width: DEFENSE_FIELD_TILES.cols * GROUND_TILE_SIZE,
    height: DEFENSE_FIELD_TILES.rows * GROUND_TILE_SIZE,
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

export function defenseHalfWidth(): number {
  return defenseFieldPx().width / 2;
}

export function defenseHalfHeight(): number {
  return defenseFieldPx().height / 2;
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
  standoffPx = wallMeleeApproachStandoffPx(DEFAULT_WALL_COMBAT),
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
export function obstaclePhysicsLayout(textureKey: ObstacleTextureKey): ObstaclePhysicsLayout {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  const block = OBSTACLE_BLOCKER_FOOTPRINT[textureKey];
  const s = DEFENSE_OBSTACLE_WORLD_SCALE;
  const bodyW =
    Math.min(block.w, crop.w) * s * OBSTACLE_COLLIDER_SIZE_SCALE;
  const bodyH =
    Math.min(block.h, crop.h) * s * OBSTACLE_COLLIDER_SIZE_SCALE;
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

export function obstacleColliderSize(textureKey: ObstacleTextureKey): {
  w: number;
  h: number;
} {
  const layout = obstaclePhysicsLayout(textureKey);
  return { w: layout.bodyW, h: layout.bodyH };
}

export function obstacleDisplaySize(textureKey: ObstacleTextureKey): {
  w: number;
  h: number;
} {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  const s = DEFENSE_OBSTACLE_WORLD_SCALE;
  return { w: crop.w * s, h: crop.h * s };
}

export const DEFENSE_MAP = {
  /** 16px nav cells — quarter ground tile — so blocked cells hug sprite mass. */
  cellSize: 16,
  /**
   * Inflate obstacle blockers on the nav grid so paths avoid gaps narrower than the
   * widest rush collision circle (grunt), plus {@link DEFENSE_MAP.cellSize} / 2 − 1 px.
   */
  pathClearancePx: maxNavObstacleClearancePx(),
  /** How close an enemy must be to a path node before advancing. */
  pathWaypointRadius: 14,
  /** Recompute A* at most this often per enemy (ms). */
  pathReplanMs: 450,
  /** No meaningful progress toward the current waypoint for this long → emergency replan. */
  pathStallMs: 400,
} as const;

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

/** Tile placements; sprite center is raised so crop feet sit on the tile center. */
export let DEFENSE_OBSTACLE_PLACEMENTS: DefenseObstaclePlacement[] = [
  { tileX: 2, tileY: 3, textureKey: OBSTACLE_TEXTURE.wideSlab },
  { tileX: 10, tileY: 4, textureKey: OBSTACLE_TEXTURE.tallRock },
  { tileX: 2, tileY: 15, textureKey: OBSTACLE_TEXTURE.rubbleLow },
  { tileX: 10, tileY: 16, textureKey: OBSTACLE_TEXTURE.boulderSm },
  { tileX: 6, tileY: 2, textureKey: OBSTACLE_TEXTURE.boulderMed },
  { tileX: 9, tileY: 11, textureKey: OBSTACLE_TEXTURE.boulderSm },
  { tileX: 4, tileY: 10, textureKey: OBSTACLE_TEXTURE.boulderMed },
  { tileX: 6, tileY: 8, textureKey: OBSTACLE_TEXTURE.rubbleLow },
];

export function defenseObstacleSpriteAnchor(
  placement: DefenseObstaclePlacement,
): { x: number; y: number } {
  const tile = defenseTileCenter(placement.tileX, placement.tileY);
  const { displayH } = obstaclePhysicsLayout(placement.textureKey);
  return {
    x: tile.x,
    y: tile.y - displayH / 2,
  };
}

/** Screen position for obstacle `Image` sprites — anchor plus cosmetic Y only. */
export function defenseObstacleSpriteDisplayPosition(
  placement: DefenseObstaclePlacement,
): { x: number; y: number } {
  const anchor = defenseObstacleSpriteAnchor(placement);
  return {
    x: anchor.x,
    y: anchor.y + DEFENSE_OBSTACLE_SPRITE_VISUAL_Y_OFFSET,
  };
}

export function defenseObstacleColliderFromPlacement(
  placement: DefenseObstaclePlacement,
): DefenseObstacleRect {
  const anchor = defenseObstacleSpriteAnchor(placement);
  const layout = obstaclePhysicsLayout(placement.textureKey);
  return {
    x: anchor.x + layout.bodyCenterOffsetX,
    y: anchor.y + layout.bodyCenterOffsetY,
    w: layout.bodyW,
    h: layout.bodyH,
    textureKey: placement.textureKey,
  };
}

/** Static rock/wall blockers (world coords = Arcade body AABB center + size). */
export const DEFENSE_OBSTACLES: DefenseObstacleRect[] =
  DEFENSE_OBSTACLE_PLACEMENTS.map(defenseObstacleColliderFromPlacement);

function refreshDefenseObstacleColliders(): void {
  DEFENSE_OBSTACLES.length = 0;
  for (const placement of DEFENSE_OBSTACLE_PLACEMENTS) {
    DEFENSE_OBSTACLES.push(defenseObstacleColliderFromPlacement(placement));
  }
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