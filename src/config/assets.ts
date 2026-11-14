/** Texture keys committed under `public/assets/`. */

export type PlayerCardinal = "s" | "e" | "n" | "w";

export const PLAYER_TEXTURE: Record<PlayerCardinal, string> = {
  s: "player_s",
  e: "player_e",
  n: "player_n",
  w: "player_w",
};

/** Combat ground fill texture (`tile_00.png` — ArtGenerationPipeline `ground-sparse-grass-night` wang_15). */
export const GROUND_TILE_TEXTURE = "ground_0";

export const GROUND_TILE_SIZE = 64;

/** Loaded ground tiles; combat uses `GROUND_TILE_TEXTURE` only. Add more Wang indices here for random fill later. */
export const GROUND_TILE_ASSETS = [
  { key: "ground_0", file: "tile_00.png" },
] as const;

/** Combat FX under `public/assets/combat/fx/` (Peter review 2026-11-14). */
export const COMBAT_FX_ASSETS = [
  {
    key: "fx_fire_bolt",
    file: "fire-bolt-v5-02-16x16.png",
  },
  {
    key: "fx_stone_throw",
    file: "stone-throw-v5-03-16x16.png",
  },
  {
    key: "fx_player_melee",
    file: "slash-arc-v2-48x48.png",
  },
  {
    key: "fx_grunt_melee",
    file: "slash-arc-v2-32x32.png",
  },
] as const;

export const COMBAT_FX_TEXTURE = {
  fireBolt: "fx_fire_bolt",
  stoneThrow: "fx_stone_throw",
  playerMelee: "fx_player_melee",
  gruntMelee: "fx_grunt_melee",
} as const;

/** On-screen size in world units (2× source pixels, nearest-neighbor filtered in Boot). */
export const SPRITE_DISPLAY = {
  player: 64,
  enemy: 64,
  fireBolt: 16,
  stoneThrow: 16,
  playerMeleeSlash: 56,
  gruntMeleeSlash: 40,
} as const;