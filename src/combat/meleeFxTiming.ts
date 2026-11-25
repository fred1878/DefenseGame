import type { EnemyMeleeCombat } from "../core/enemyTuning";

/**
 * `fxStartMs` in data is delay from swing windup start (idle→windup), not from active.
 * Required in JSON — no runtime default.
 */
export function finalizeEnemyMeleeFxTiming(
  _enemyDefId: string,
  melee: EnemyMeleeCombat,
): EnemyMeleeCombat {
  return melee;
}

/**
 * Phaser `anims.timeScale` for enemy sheets.
 * Omit target → 1 (natural speed). Shorter target → speed up; longer → slow/stretch.
 */
export function meleeFxPlaybackTimeScale(
  naturalDurationMs: number,
  targetDurationMs: number | undefined,
): number {
  if (
    targetDurationMs === undefined ||
    targetDurationMs <= 0 ||
    naturalDurationMs <= 0
  ) {
    return 1;
  }
  return naturalDurationMs / targetDurationMs;
}