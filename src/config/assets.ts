/** Texture keys committed under `public/assets/`. */

export type PlayerCardinal = "s" | "e" | "n" | "w";

export const PLAYER_TEXTURE: Record<PlayerCardinal, string> = {
  s: "player_s",
  e: "player_e",
  n: "player_n",
  w: "player_w",
};

/** Combat ground fill (`tile_00.png` — `ground-sparse-grass-night` wang_15). */
export const GROUND_TILE_TEXTURE = "ground_0";

export const GROUND_TILE_SIZE = 64;

/** Ground tiles loaded in Boot; combat repeats `GROUND_TILE_TEXTURE` only. */
export const GROUND_TILE_ASSETS = [
  { key: "ground_0", file: "tile_00.png" },
] as const;

/** Sparse transparent props over `ground_0` (no nav blocking). */
export const GROUND_DECOR_ASSETS = [
  { key: "ground_decor_pebble_a", file: "ground_decor_pebble_a_24.png" },
  { key: "ground_decor_pebble_b", file: "ground_decor_pebble_b_24.png" },
  { key: "ground_decor_rock_sm", file: "ground_decor_rock_sm_32.png" },
  { key: "ground_decor_shrub_low", file: "ground_decor_shrub_low_32.png" },
  { key: "ground_decor_dry_tuft", file: "ground_decor_dry_tuft_24.png" },
  { key: "ground_decor_twigs", file: "ground_decor_twigs_24.png" },
] as const;

export const GROUND_DECOR_DISPLAY: Record<
  (typeof GROUND_DECOR_ASSETS)[number]["key"],
  number
> = {
  ground_decor_pebble_a: 20,
  ground_decor_pebble_b: 20,
  ground_decor_rock_sm: 28,
  ground_decor_shrub_low: 28,
  ground_decor_dry_tuft: 22,
  ground_decor_twigs: 20,
};

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
  playerMeleeSlash: 68,
  gruntMeleeSlash: 40,
} as const;

/** Gothic fantasy HUD under `public/assets/ui/gothic/` (UI-REVIEW v01 picks). */
export const UI_ASSETS = [
  {
    key: "ui_atk_circle",
    file: "buttons/action-attack-circle-v01-64x64.png",
  },
  {
    key: "ui_mode_rect_v01",
    file: "buttons/action-mode-rect-v01-64x64.png",
  },
  {
    key: "ui_mode_rect_v02",
    file: "buttons/action-mode-rect-v02-64x64.png",
  },
  {
    key: "ui_spell_slot",
    file: "frames/spell-slot-frame-v01-64x64.png",
  },
  {
    key: "ui_icon_backing",
    file: "frames/icon-backing-v01-48x48.png",
  },
  {
    key: "ui_hud_bottom_strip",
    file: "panels/hud-bottom-strip-v01-512x192.png",
  },
  {
    key: "ui_hud_panel_compact",
    file: "panels/hud-panel-compact-v01-384x192.png",
  },
  {
    key: "ui_hud_panel_square",
    file: "panels/hud-panel-square-v01-256x256.png",
  },
  {
    key: "ui_hud_panel_tall",
    file: "panels/hud-panel-tall-v01-256x384.png",
  },
] as const;

export const UI_TEXTURE = {
  atkCircle: "ui_atk_circle",
  /** Ashlar slab — no baked labels (v01 pill had sample text). */
  modeRect: "ui_mode_rect_v02",
  autoRect: "ui_mode_rect_v02",
  spellSlot: "ui_spell_slot",
  iconBacking: "ui_icon_backing",
  bottomStrip: "ui_hud_bottom_strip",
  panelCompact: "ui_hud_panel_compact",
  panelSquare: "ui_hud_panel_square",
  panelTall: "ui_hud_panel_tall",
} as const;

/** 9-slice insets (source pixels) for scalable HUD panels. */
export const UI_NINE_SLICE = {
  bottomStrip: { left: 64, right: 64, top: 56, bottom: 56 },
  panelCompact: { left: 48, right: 48, top: 40, bottom: 40 },
  panelSquare: { left: 56, right: 56, top: 56, bottom: 56 },
  panelTall: { left: 56, right: 56, top: 72, bottom: 72 },
  /** Full-width bottom HUD using tall panel art (short height) — crop baked sample in center. */
  panelTallBottomBar: { left: 52, right: 52, top: 288, bottom: 64 },
} as const;

export const UI_ASSET_ROOT = "assets/ui/gothic";

/** Gothic defense field obstacles (`public/assets/sprites/obstacles/`). */
export const DEFENSE_OBSTACLE_ASSETS = [
  { key: "obstacle_wide_slab", file: "obstacle_wide_slab.png" },
  { key: "obstacle_tall_rock", file: "obstacle_tall_rock.png" },
  { key: "obstacle_boulder_med", file: "obstacle_boulder_med.png" },
  { key: "obstacle_rubble_low", file: "obstacle_rubble_low.png" },
  { key: "obstacle_boulder_sm", file: "obstacle_boulder_sm.png" },
] as const;

export const OBSTACLE_TEXTURE = {
  wideSlab: "obstacle_wide_slab",
  tallRock: "obstacle_tall_rock",
  boulderMed: "obstacle_boulder_med",
  rubbleLow: "obstacle_rubble_low",
  boulderSm: "obstacle_boulder_sm",
} as const;

export type ObstacleTextureKey =
  (typeof OBSTACLE_TEXTURE)[keyof typeof OBSTACLE_TEXTURE];

/** Native PNG dimensions — collider/display sizes should match these (see defense.ts). */
export const OBSTACLE_SOURCE_FRAME: Record<
  (typeof OBSTACLE_TEXTURE)[keyof typeof OBSTACLE_TEXTURE],
  { w: number; h: number }
> = {
  obstacle_wide_slab: { w: 90, h: 54 },
  obstacle_tall_rock: { w: 70, h: 90 },
  obstacle_boulder_med: { w: 60, h: 60 },
  obstacle_rubble_low: { w: 100, h: 50 },
  obstacle_boulder_sm: { w: 56, h: 56 },
};

/** Opaque art bounds in source pixels — crop before scaling to collider size. */
export const OBSTACLE_SPRITE_CROP: Record<
  (typeof OBSTACLE_TEXTURE)[keyof typeof OBSTACLE_TEXTURE],
  { x: number; y: number; w: number; h: number }
> = {
  obstacle_wide_slab: { x: 8, y: 14, w: 75, h: 32 },
  obstacle_tall_rock: { x: 2, y: 6, w: 66, h: 75 },
  obstacle_boulder_med: { x: 14, y: 11, w: 36, h: 35 },
  obstacle_rubble_low: { x: 32, y: 12, w: 36, h: 26 },
  obstacle_boulder_sm: { x: 13, y: 16, w: 28, h: 24 },
};
