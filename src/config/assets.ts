/** Texture keys committed under `public/assets/`. */

export type PlayerCardinal = "s" | "e" | "n" | "w";

export const PLAYER_TEXTURE: Record<PlayerCardinal, string> = {
  s: "player_s",
  e: "player_e",
  n: "player_n",
  w: "player_w",
};

/** Combat ground layer uses this texture only (`tile_00.png`). */
export const GROUND_TILE_TEXTURE = "ground_0";

export const GROUND_TILE_SIZE = 64;

/** Ground tiles kept in repo for later; only index 0 is used in combat. */
export const GROUND_TILE_ASSETS = [
  { key: "ground_0", file: "tile_00.png" },
  { key: "ground_3", file: "tile_03.png" },
  { key: "ground_7", file: "tile_07.png" },
] as const;

export const SPRITE_DISPLAY = {
  player: 32,
  enemy: 32,
} as const;