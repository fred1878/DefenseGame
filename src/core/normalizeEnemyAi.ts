import {
  ENEMY_AI_DEFAULTS,
  type EnemyAiTuning,
} from "../config/enemy";

export type EnemyAiInput = Partial<EnemyAiTuning>;

export function normalizeEnemyAi(
  raw: EnemyAiInput | null | undefined,
): EnemyAiTuning {
  if (!raw) return { ...ENEMY_AI_DEFAULTS };
  return {
    playerAggroRadius: finiteOr(
      raw.playerAggroRadius,
      ENEMY_AI_DEFAULTS.playerAggroRadius,
    ),
    playerChaseMemoryMs: finiteOr(
      raw.playerChaseMemoryMs,
      ENEMY_AI_DEFAULTS.playerChaseMemoryMs,
    ),
    wallVelocityBlendMs: finiteOr(
      raw.wallVelocityBlendMs,
      ENEMY_AI_DEFAULTS.wallVelocityBlendMs,
    ),
  };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value! : fallback;
}