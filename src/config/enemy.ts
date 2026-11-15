/** Chase player when line-of-sight is clear and distance ≤ this (world px). */
export const PLAYER_AGGRO_RADIUS = 320;

/** After LOS breaks, keep chasing last known player position for this long (ms). */
export const PLAYER_CHASE_MEMORY_MS = 2000;

/** Blend from chase velocity toward wall path when abandoning player pursuit (ms). */
export const WALL_VELOCITY_BLEND_MS = 420;