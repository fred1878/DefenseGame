import {
  OBSTACLE_TEXTURE,
  type ObstacleTextureKey,
} from "../content/assets";
import { GAME } from "./game";

/** North settlement wall — attack target plane (world y). */
export function northWallAttackY(): number {
  const half = GAME.worldHalfSize;
  return -half + 20 + 20;
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

/** Static rock/wall blocks on the defense field (world coords, center origin). */
export const DEFENSE_OBSTACLES: DefenseObstacleRect[] = [
  { x: -300, y: -200, w: 90, h: 54, textureKey: OBSTACLE_TEXTURE.wideSlab },
  { x: 320, y: -160, w: 70, h: 90, textureKey: OBSTACLE_TEXTURE.tallRock },
  { x: -260, y: 220, w: 100, h: 50, textureKey: OBSTACLE_TEXTURE.rubbleLow },
  { x: 300, y: 260, w: 56, h: 56, textureKey: OBSTACLE_TEXTURE.boulderSm },
  { x: -150, y: -320, w: 60, h: 60, textureKey: OBSTACLE_TEXTURE.boulderMed },
  { x: 240, y: 40, w: 56, h: 56, textureKey: OBSTACLE_TEXTURE.boulderSm },
  { x: -200, y: 100, w: 60, h: 60, textureKey: OBSTACLE_TEXTURE.boulderMed },
  { x: -60, y: -250, w: 100, h: 50, textureKey: OBSTACLE_TEXTURE.rubbleLow },
];