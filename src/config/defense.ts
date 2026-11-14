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
  { x: 80, y: -140, w: 90, h: 55 },
  { x: 160, y: 60, w: 70, h: 90 },
  { x: 240, y: -40, w: 60, h: 60 },
  { x: -40, y: 180, w: 100, h: 50 },
  { x: 60, y: 200, w: 55, h: 55 },
];