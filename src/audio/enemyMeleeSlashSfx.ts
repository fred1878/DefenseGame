import type Phaser from "phaser";
import { sfxVolumes } from "../config/audio";

export const ENEMY_MELEE_SLASH_SFX_KEYS = [
  "sfx_enemy_melee_slash_01",
  "sfx_enemy_melee_slash_02",
] as const;

export type EnemyMeleeSlashSfxKey = (typeof ENEMY_MELEE_SLASH_SFX_KEYS)[number];

export function pickEnemyMeleeSlashSfxKey(
  rng: () => number = Math.random,
): EnemyMeleeSlashSfxKey {
  const index = Math.min(
    Math.floor(rng() * ENEMY_MELEE_SLASH_SFX_KEYS.length),
    ENEMY_MELEE_SLASH_SFX_KEYS.length - 1,
  );
  return ENEMY_MELEE_SLASH_SFX_KEYS[index]!;
}

/** Plays a random variant when an enemy melee swipe becomes active. */
export function playEnemyMeleeSlashSfx(scene: Phaser.Scene): void {
  const key = pickEnemyMeleeSlashSfxKey();
  if (!scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume: sfxVolumes().enemyMeleeSlashVolume });
}
