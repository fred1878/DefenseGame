export type EnemyAiTuning = {
  playerAggroRadiusWu: number;
  playerChaseMemoryMs: number;
  wallVelocityBlendMs: number;
  /** Global path goal offset south of the north wall (world units). */
  northWallMeleeStandoffWu: number;
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

/** Chase player when line-of-sight is clear and distance ≤ scaled px from this WU (see `playerAggroRadiusWu`). */
export let PLAYER_AGGRO_RADIUS = unsetAiScalar("PLAYER_AGGRO_RADIUS");

/** After LOS breaks, keep chasing last known player position for this long (ms). */
export let PLAYER_CHASE_MEMORY_MS = unsetAiScalar("PLAYER_CHASE_MEMORY_MS");

/** Blend from chase velocity toward wall path when abandoning player pursuit (ms). */
export let WALL_VELOCITY_BLEND_MS = unsetAiScalar("WALL_VELOCITY_BLEND_MS");

/** Path goal south of {@link northWallAttackY} for wall-rush navigation (world units). */
export let NORTH_WALL_MELEE_STANDOFF_WU = unsetAiScalar(
  "NORTH_WALL_MELEE_STANDOFF_WU",
);

export function applyEnemyAi(tuning: EnemyAiTuning): void {
  PLAYER_AGGRO_RADIUS = tuning.playerAggroRadiusWu;
  PLAYER_CHASE_MEMORY_MS = tuning.playerChaseMemoryMs;
  WALL_VELOCITY_BLEND_MS = tuning.wallVelocityBlendMs;
  NORTH_WALL_MELEE_STANDOFF_WU = tuning.northWallMeleeStandoffWu;
}