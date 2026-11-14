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
};

/** Static rock/wall blocks on the defense field (world coords, center origin). */
export const DEFENSE_OBSTACLES: DefenseObstacleRect[] = [
  { x: -300, y: -200, w: 90, h: 55 },
  { x: 320, y: -160, w: 70, h: 90 },
  { x: -260, y: 220, w: 100, h: 50 },
  { x: 300, y: 260, w: 55, h: 55 },
  { x: -150, y: -320, w: 60, h: 60 },
];