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

/** On-screen size in world units (2× source pixels, nearest-neighbor filtered in Boot). */
export const SPRITE_DISPLAY = {
  player: 64,
  enemy: 64,
  projectile: 16,
} as const;