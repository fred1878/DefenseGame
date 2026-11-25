import type Phaser from "phaser";
import { COMBAT_AUDIO } from "../config/audio";

export const PLAYER_MELEE_SLASH_SFX_KEYS = [
  "sfx_player_melee_slash_01",
  "sfx_player_melee_slash_02",
] as const;

export type PlayerMeleeSlashSfxKey = (typeof PLAYER_MELEE_SLASH_SFX_KEYS)[number];

export function pickPlayerMeleeSlashSfxKey(
  rng: () => number = Math.random,
): PlayerMeleeSlashSfxKey {
  const index = Math.min(
    Math.floor(rng() * PLAYER_MELEE_SLASH_SFX_KEYS.length),
    PLAYER_MELEE_SLASH_SFX_KEYS.length - 1,
  );
  return PLAYER_MELEE_SLASH_SFX_KEYS[index]!;
}

/** Plays a random variant when the player melee swipe becomes active. */
export function playPlayerMeleeSlashSfx(scene: Phaser.Scene): void {
  const key = pickPlayerMeleeSlashSfxKey();
  if (!scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume: COMBAT_AUDIO.playerMeleeSlashVolume });
}