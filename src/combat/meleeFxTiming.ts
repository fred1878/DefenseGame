import {
  enemyMeleeFxClipId,
  meleeFxAnimDurationMs,
} from "../content/meleeFxAssets";
import type { EnemyMeleeCombat } from "../core/enemyTuning";

/**
 * `fxStartMs` in data is delay from swing windup start (idle→windup), not from active.
 * Omit in JSON → {@link defaultEnemyMeleeFxStartMs} (`windupMs`) so VFX lines up with today.
 */
export function defaultEnemyMeleeFxStartMs(windupMs: number): number {
  return windupMs;
}

export function defaultEnemyMeleeFxDurationMs(
  enemyDefId: string,
  activeMs: number,
): number {
  const clipId = enemyMeleeFxClipId(enemyDefId);
  if (!clipId) return activeMs;
  const natural = meleeFxAnimDurationMs(clipId);
  return natural > 0 ? natural : activeMs;
}

export function finalizeEnemyMeleeFxTiming(
  enemyDefId: string,
  melee: Omit<EnemyMeleeCombat, "fxStartMs" | "fxDurationMs"> & {
    fxStartMs?: number;
    fxDurationMs?: number;
  },
): EnemyMeleeCombat {
  return {
    ...melee,
    fxStartMs: melee.fxStartMs ?? defaultEnemyMeleeFxStartMs(melee.windupMs),
    fxDurationMs:
      melee.fxDurationMs ??
      defaultEnemyMeleeFxDurationMs(enemyDefId, melee.activeMs),
  };
}

/** Phaser `anims.timeScale` so sheet playback lasts `fxDurationMs` on screen. */
export function meleeFxPlaybackTimeScale(
  naturalDurationMs: number,
  fxDurationMs: number,
): number {
  if (fxDurationMs <= 0 || naturalDurationMs <= 0) return 1;
  return naturalDurationMs / fxDurationMs;
}