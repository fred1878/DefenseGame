/** Texture keys committed under `public/assets/`. */

export type PlayerCardinal = "s" | "e" | "n" | "w";

export const PLAYER_TEXTURE: Record<PlayerCardinal, string> = {
  s: "player_s",
  e: "player_e",
  n: "player_n",
  w: "player_w",
};

/** Ordered keys for multi-tile ground (`ground_0` → `tile_00.png`, …). */
export const GROUND_TILE_KEYS = [
  "ground_0",
  "ground_1",
  "ground_2",
  "ground_3",
  "ground_4",
  "ground_5",
  "ground_6",
  "ground_7",
] as const;

export const GROUND_TILE_SIZE = 64;

export const SPRITE_DISPLAY = {
  player: 32,
  enemy: 32,
} as const;