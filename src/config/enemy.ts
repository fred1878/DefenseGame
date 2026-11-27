import { setTuning } from "../tuning/gameTuning";

export type EnemyAiTuning = {
  playerAggroRadiusWu: number;
  playerChaseMemoryMs: number;
  wallVelocityBlendMs: number;
  /** Global path goal offset south of the north wall (world units). */
  northWallMeleeStandoffWu: number;
};

/** Replace enemy AI tuning after `public/data/enemy-ai.json` loads (Boot). Read with `tuning("enemyAi")`. */
export function applyEnemyAi(next: EnemyAiTuning): void {
  setTuning("enemyAi", next);
}
