import type Phaser from "phaser";
import { ECONOMY_AUDIO } from "../config/audio";

export const COIN_SPEND_SFX_KEY = "sfx_coin_spend_01";
export const COIN_GAIN_SFX_KEY = "sfx_coin_gain_01";

/** Plays when gold is spent (building upgrades, etc.). */
export function playCoinSpendSfx(scene: Phaser.Scene): void {
  if (!scene.cache.audio.exists(COIN_SPEND_SFX_KEY)) return;
  scene.sound.play(COIN_SPEND_SFX_KEY, {
    volume: ECONOMY_AUDIO.coinSpendVolume,
  });
}

/** Plays when gold is earned (night rewards, etc.). */
export function playCoinGainSfx(scene: Phaser.Scene): void {
  if (!scene.cache.audio.exists(COIN_GAIN_SFX_KEY)) return;
  scene.sound.play(COIN_GAIN_SFX_KEY, { volume: ECONOMY_AUDIO.coinGainVolume });
}

/** Plays spend or gain one-shot from a gold balance change. */
export function playCoinDeltaSfx(
  scene: Phaser.Scene,
  goldBefore: number,
  goldAfter: number,
): void {
  const delta = goldAfter - goldBefore;
  if (delta < 0) playCoinSpendSfx(scene);
  else if (delta > 0) playCoinGainSfx(scene);
}
