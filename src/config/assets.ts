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
