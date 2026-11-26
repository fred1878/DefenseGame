/** Texture keys committed under `public/assets/`. */

export type PlayerCardinal = "s" | "e" | "n" | "w";

export const PLAYER_TEXTURE: Record<PlayerCardinal, string> = {
  s: "player_s",
  e: "player_e",
  n: "player_n",
  w: "player_w",
};

/** `enemies.json` ids with 4-dir art under `public/assets/sprites/enemies/<id>/`. */
export const ENEMY_SPRITE_IDS = [
  "grunt",
  "bruiser",
  "skirmisher",
  "arrow_rain_archer",
  "sentry_archer",
  "javelineer",
  "slow_siege",
  "fast_sapper",
  "charger",
  "lobber",
  "ward",
  "reaver",
] as const;

const ENEMY_CARDINALS: PlayerCardinal[] = ["n", "e", "s", "w"];

export const enemyTextureKey = (
  baseKey: string,
  card: PlayerCardinal,
): string => `${baseKey}_${card}`;

/** Enemy field sprites (`public/assets/sprites/enemies/`, 64×64, nearest in Boot). */
export const ENEMY_SPRITE_ASSETS = ENEMY_SPRITE_IDS.flatMap((enemyId) =>
  ENEMY_CARDINALS.map((card) => ({
    key: enemyTextureKey(`enemy_${enemyId}`, card),
    file: `${card}.png`,
    enemyId,
  })),
);

/** Combat ground fill (`tile_00.png` — `ground-sparse-grass-night` wang_15). */
export const GROUND_TILE_TEXTURE = "ground_0";

export const GROUND_TILE_SIZE = 64;

/** Ground tiles loaded in Boot; combat repeats `GROUND_TILE_TEXTURE` only. */
export const GROUND_TILE_ASSETS = [
  { key: "ground_0", file: "tile_00.png" },
] as const;

/** Sparse transparent 16×16 props over `ground_0` (no nav blocking). */
export const GROUND_DECOR_ASSETS = [
  { key: "ground_decor_pebble_a", file: "ground_decor_pebble_a_16.png" },
  { key: "ground_decor_pebble_b", file: "ground_decor_pebble_b_16.png" },
  { key: "ground_decor_rock_sm", file: "ground_decor_rock_sm_16.png" },
  { key: "ground_decor_shrub_low", file: "ground_decor_shrub_low_16.png" },
  { key: "ground_decor_dry_tuft", file: "ground_decor_dry_tuft_16.png" },
  { key: "ground_decor_twigs", file: "ground_decor_twigs_16.png" },
] as const;

/** 1:1 source px on field (16×16 art). */
export const GROUND_DECOR_DISPLAY: Record<
  (typeof GROUND_DECOR_ASSETS)[number]["key"],
  number
> = {
  ground_decor_pebble_a: 16,
  ground_decor_pebble_b: 16,
  ground_decor_rock_sm: 16,
  ground_decor_shrub_low: 16,
  ground_decor_dry_tuft: 16,
  ground_decor_twigs: 16,
};

/** Generic combat FX (`public/assets/combat/fx/`) — not used for spell bar or spell projectiles. */
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

/** Spell combat art re-sliced from MobileRPG atlas (`public/assets/spells/fx/`). */
export const SPELL_FX_ASSETS = [
  {
    key: "fx_spell_fire_bolt",
    file: "fire-bolt-mrpg-16.png",
    root: "assets/spells/fx",
  },
  {
    key: "fx_spell_ice_bolt",
    file: "ice-bolt-mrpg-16.png",
    root: "assets/spells/fx",
  },
  {
    key: "fx_spell_lightning_bolt",
    file: "lightning-bolt-mrpg-16.png",
    root: "assets/spells/fx",
  },
  {
    key: "fx_spell_water_bolt",
    file: "water-bolt-mrpg-16.png",
    root: "assets/spells/fx",
  },
  {
    key: "fx_spell_arc_bomb",
    file: "arc-bomb-mrpg-16.png",
    root: "assets/spells/fx",
  },
  {
    key: "fx_spell_fire_nova",
    file: "fire-nova-mrpg-64.png",
    root: "assets/spells/fx",
  },
  {
    key: "fx_spell_shockwave",
    file: "shockwave-mrpg-64.png",
    root: "assets/spells/fx",
  },
  {
    key: "fx_spell_blizzard",
    file: "blizzard-mrpg-32.png",
    root: "assets/spells/fx",
  },
] as const;

export const COMBAT_FX_TEXTURE = {
  fireBolt: "fx_fire_bolt",
  stoneThrow: "fx_stone_throw",
  spellFireBolt: "fx_spell_fire_bolt",
  spellIceBolt: "fx_spell_ice_bolt",
  spellLightningBolt: "fx_spell_lightning_bolt",
  spellWaterBolt: "fx_spell_water_bolt",
  spellArcBomb: "fx_spell_arc_bomb",
  spellFireNova: "fx_spell_fire_nova",
  spellShockwave: "fx_spell_shockwave",
  spellBlizzard: "fx_spell_blizzard",
  playerMelee: "fx_player_melee",
  gruntMelee: "fx_grunt_melee",
} as const;

/** Hotbar icons under `public/assets/spells/icons/` (MobileRPG atlas slices, 64×64). */
export const SPELL_ICON_ASSETS = [
  { key: "spell_icon_fire_bolt", file: "fire_bolt.png" },
  { key: "spell_icon_ice_bolt", file: "ice_bolt.png" },
  { key: "spell_icon_lightning_bolt", file: "lightning_bolt.png" },
  { key: "spell_icon_water_bolt", file: "water_bolt.png" },
  { key: "spell_icon_arc_bomb", file: "arc_bomb.png" },
  { key: "spell_icon_swing", file: "swing.png" },
  { key: "spell_icon_rend", file: "rend.png" },
  { key: "spell_icon_cone_of_cold", file: "cone_of_cold.png" },
  { key: "spell_icon_cone_of_fire", file: "cone_of_fire.png" },
  { key: "spell_icon_fire_blast", file: "fire_blast.png" },
  { key: "spell_icon_fire_nova", file: "fire_nova.png" },
  { key: "spell_icon_blizzard", file: "blizzard.png" },
  { key: "spell_icon_meteor", file: "meteor.png" },
  { key: "spell_icon_frost_nova", file: "frost_nova.png" },
  { key: "spell_icon_ice_wall", file: "ice_wall.png" },
  { key: "spell_icon_flamestrike", file: "flamestrike.png" },
  { key: "spell_icon_shadowform", file: "shadowform.png" },
  { key: "spell_icon_deep_freeze", file: "deep_freeze.png" },
  { key: "spell_icon_chain_lightning", file: "chain_lightning.png" },
  { key: "spell_icon_blink", file: "blink.png" },
  { key: "spell_icon_combustion", file: "combustion.png" },
  { key: "spell_icon_heal", file: "heal.png" },
  { key: "spell_icon_flash_heal", file: "flash_heal.png" },
] as const;

export const SPELL_ICON_ROOT = "assets/spells/icons";

export const spellIconTextureKey = (spellId: string): string =>
  `spell_icon_${spellId}`;

/** On-screen size in world units (2× source pixels, nearest-neighbor filtered in Boot). */
export const SPRITE_DISPLAY = {
  player: 64,
  enemy: 64,
  fireBolt: 16,
  stoneThrow: 16,
  /** World display px; +40% vs 68px baseline. */
  playerMeleeSlash: 93,
  gruntMeleeSlash: 38,
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

/** Opaque art bounds in source pixels — sprite display crop (1:1 world px). */
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

/** Tighter gameplay blockers — opaque stone mass only (≤ crop), not transparent halo. */
export const OBSTACLE_BLOCKER_FOOTPRINT: Record<
  (typeof OBSTACLE_TEXTURE)[keyof typeof OBSTACLE_TEXTURE],
  { w: number; h: number }
> = {
  obstacle_wide_slab: { w: 58, h: 22 },
  obstacle_tall_rock: { w: 52, h: 62 },
  obstacle_boulder_med: { w: 30, h: 28 },
  obstacle_rubble_low: { w: 28, h: 18 },
  obstacle_boulder_sm: { w: 22, h: 18 },
};
