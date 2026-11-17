/**
 * One-shots under `public/assets/audio/sfx/`.
 * Melee slash + coin economy clips: Zapsplat (Standard License; https://www.zapsplat.com).
 */
export const COMBAT_SFX_ASSETS = [
  { key: "sfx_player_melee_slash_01", file: "player_melee_slash_01.mp3" },
  { key: "sfx_player_melee_slash_02", file: "player_melee_slash_02.mp3" },
  { key: "sfx_enemy_melee_slash_01", file: "enemy_melee_slash_01.mp3" },
  { key: "sfx_enemy_melee_slash_02", file: "enemy_melee_slash_02.mp3" },
] as const;

export const ECONOMY_SFX_ASSETS = [
  { key: "sfx_coin_spend_01", file: "coin_spend_01.mp3" },
  { key: "sfx_coin_gain_01", file: "coin_gain_01.mp3" },
] as const;

export const SFX_ASSETS = [...COMBAT_SFX_ASSETS, ...ECONOMY_SFX_ASSETS] as const;

export const SFX_ASSET_ROOT = "assets/audio/sfx";