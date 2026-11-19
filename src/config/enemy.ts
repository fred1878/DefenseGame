export type EnemyAiTuning = {
  playerAggroRadius: number;
  playerChaseMemoryMs: number;
  wallVelocityBlendMs: number;
};

function unsetAiScalar(label: string): number {
  return new Proxy({} as object, {
    get() {
      throw new Error(
        `${label} not loaded — Boot must apply public/data/enemy-ai.json`,
      );
    },
  }) as unknown as number;
}

/** Chase player when line-of-sight is clear and distance ≤ this (world px). */
export let PLAYER_AGGRO_RADIUS = unsetAiScalar("PLAYER_AGGRO_RADIUS");

/** After LOS breaks, keep chasing last known player position for this long (ms). */
export let PLAYER_CHASE_MEMORY_MS = unsetAiScalar("PLAYER_CHASE_MEMORY_MS");

/** Blend from chase velocity toward wall path when abandoning player pursuit (ms). */
export let WALL_VELOCITY_BLEND_MS = unsetAiScalar("WALL_VELOCITY_BLEND_MS");

export function applyEnemyAi(tuning: EnemyAiTuning): void {
  PLAYER_AGGRO_RADIUS = tuning.playerAggroRadius;
  PLAYER_CHASE_MEMORY_MS = tuning.playerChaseMemoryMs;
  WALL_VELOCITY_BLEND_MS = tuning.wallVelocityBlendMs;
}