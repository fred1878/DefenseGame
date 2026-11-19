export type EnemyAiTuning = {
  playerAggroRadius: number;
  playerChaseMemoryMs: number;
  wallVelocityBlendMs: number;
};

export const ENEMY_AI_DEFAULTS: EnemyAiTuning = {
  playerAggroRadius: 320,
  playerChaseMemoryMs: 2000,
  wallVelocityBlendMs: 420,
};

/** Chase player when line-of-sight is clear and distance ≤ this (world px). */
export let PLAYER_AGGRO_RADIUS = ENEMY_AI_DEFAULTS.playerAggroRadius;

/** After LOS breaks, keep chasing last known player position for this long (ms). */
export let PLAYER_CHASE_MEMORY_MS = ENEMY_AI_DEFAULTS.playerChaseMemoryMs;

/** Blend from chase velocity toward wall path when abandoning player pursuit (ms). */
export let WALL_VELOCITY_BLEND_MS = ENEMY_AI_DEFAULTS.wallVelocityBlendMs;

export function applyEnemyAi(tuning: EnemyAiTuning): void {
  PLAYER_AGGRO_RADIUS = tuning.playerAggroRadius;
  PLAYER_CHASE_MEMORY_MS = tuning.playerChaseMemoryMs;
  WALL_VELOCITY_BLEND_MS = tuning.wallVelocityBlendMs;
}