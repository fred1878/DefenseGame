import type { EnemyAiTuning } from "../config/enemy";
import { requireFiniteNumber, requireRecord } from "./configValidation";

export type EnemyAiInput = Partial<EnemyAiTuning>;

/** Boot-required keys for `public/data/enemy-ai.json` (see `DATA_FIELDS.md`). */
export const ENEMY_AI_BOOT_KEYS = [
  "playerAggroRadiusWu",
  "playerChaseMemoryMs",
  "wallVelocityBlendMs",
  "northWallMeleeStandoffWu",
] as const satisfies readonly (keyof EnemyAiTuning)[];

export function normalizeEnemyAi(
  raw: EnemyAiInput | null | undefined,
): EnemyAiTuning {
  const root = requireRecord(raw, "enemy-ai");
  const out = {} as EnemyAiTuning;
  for (const key of ENEMY_AI_BOOT_KEYS) {
    out[key] = requireFiniteNumber(root[key], `enemy-ai.${key}`);
  }
  return out;
}