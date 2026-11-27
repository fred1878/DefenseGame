import Phaser from "phaser";
import {
  COMBAT_FX_ASSETS,
  SPELL_FX_ASSETS,
  SPELL_ICON_ASSETS,
  DEFENSE_OBSTACLE_ASSETS,
  GROUND_DECOR_ASSETS,
  GROUND_TILE_ASSETS,
  GROUND_TILE_TEXTURE,
  ENEMY_SPRITE_ASSETS,
  PLAYER_TEXTURE,
  UI_ASSETS,
} from "../content/assets";
import { TOWN_BUILDING_ASSETS } from "../content/townBuildingAssets";
import { HOLY_FX_ASSETS } from "../content/holyFxAssets";
import { ICE_FX_ASSETS } from "../content/iceFxAssets";
import { PVFX_FX_ASSETS } from "../content/combatPvfxAssets";
import { MELEE_FX_ASSETS } from "../content/meleeFxAssets";
import { SMOKE_FX_ASSETS } from "../content/smokeFxAssets";
export type WorldTextureFilterMode = "nearest" | "linear" | "hybrid";

export const DEBUG_WORLD_TEXTURE_FILTER_KEY = "debugWorldTextureFilter";

const TEXTURE_FILTER_CYCLE: WorldTextureFilterMode[] = [
  "nearest",
  "linear",
  "hybrid",
];

export function getDebugWorldTextureFilter(
  registry: Phaser.Data.DataManager,
): WorldTextureFilterMode {
  const v = registry.get(DEBUG_WORLD_TEXTURE_FILTER_KEY) as
    | WorldTextureFilterMode
    | undefined;
  if (v === "linear" || v === "hybrid") return v;
  return "nearest";
}

export function cycleDebugWorldTextureFilter(
  registry: Phaser.Data.DataManager,
): WorldTextureFilterMode {
  const cur = getDebugWorldTextureFilter(registry);
  const i = TEXTURE_FILTER_CYCLE.indexOf(cur);
  const next = TEXTURE_FILTER_CYCLE[(i + 1) % TEXTURE_FILTER_CYCLE.length]!;
  registry.set(DEBUG_WORLD_TEXTURE_FILTER_KEY, next);
  return next;
}

const GAME_SPRITE_KEYS = [
  ...Object.values(PLAYER_TEXTURE),
  ...ENEMY_SPRITE_ASSETS.map((a) => a.key),
  ...COMBAT_FX_ASSETS.map((a) => a.key),
  ...SPELL_FX_ASSETS.map((a) => a.key),
  ...SPELL_ICON_ASSETS.map((a) => a.key),
];

/**
 * Hybrid mode: LINEAR sampling on these combat VFX atlases only (smooth particles / glow).
 * Everything else in {@link allPixelArtTextureKeys} stays NEAREST.
 */
export const HYBRID_LINEAR_TEXTURE_KEYS = [
  ...PVFX_FX_ASSETS.map((a) => a.key),
  ...HOLY_FX_ASSETS.map((a) => a.key),
  ...ICE_FX_ASSETS.map((a) => a.key),
  ...SPELL_FX_ASSETS.map((a) => a.key),
] as const;

const HYBRID_LINEAR_SET = new Set<string>(HYBRID_LINEAR_TEXTURE_KEYS);

/** Every loaded texture key that {@link configurePixelArtTextures} can filter. */
export function allPixelArtTextureKeys(): readonly string[] {
  return [
    ...GAME_SPRITE_KEYS,
    GROUND_TILE_TEXTURE,
    ...GROUND_TILE_ASSETS.map((a) => a.key),
    ...GROUND_DECOR_ASSETS.map((a) => a.key),
    ...DEFENSE_OBSTACLE_ASSETS.map((a) => a.key),
    ...UI_ASSETS.map((a) => a.key),
    ...TOWN_BUILDING_ASSETS.map((a) => a.key),
    ...HOLY_FX_ASSETS.map((a) => a.key),
    ...ICE_FX_ASSETS.map((a) => a.key),
    ...PVFX_FX_ASSETS.map((a) => a.key),
    ...MELEE_FX_ASSETS.map((a) => a.key),
    ...SMOKE_FX_ASSETS.map((a) => a.key),
  ];
}

export function textureFilterForKey(
  key: string,
  mode: WorldTextureFilterMode,
): Phaser.Textures.FilterMode {
  if (mode === "linear") return Phaser.Textures.FilterMode.LINEAR;
  if (mode === "hybrid" && HYBRID_LINEAR_SET.has(key)) {
    return Phaser.Textures.FilterMode.LINEAR;
  }
  return Phaser.Textures.FilterMode.NEAREST;
}

export function isHybridLinearTextureKey(key: string): boolean {
  return HYBRID_LINEAR_SET.has(key);
}

/** Nearest-neighbor sampling for world sprites/tiles; UI stays vector (Graphics/Text). */
export function configurePixelArtTextures(scene: Phaser.Scene): void {
  const mode = getDebugWorldTextureFilter(scene.game.registry);
  const keys = allPixelArtTextureKeys();
  for (const key of keys) {
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(textureFilterForKey(key, mode));
  }
}

/** Generated SVG talent icons are vector art and look better smoothed. */
const SMOOTH_TEXTURE_PREFIXES = ["talent_icon_"] as const;

/**
 * The renderer runs with `antialias: true` (so Text samples LINEAR at the hi-DPI
 * backing resolution), which makes Phaser's default texture filter LINEAR. Keep the
 * old pixel-art default: every texture added later starts NEAREST (or follows the
 * debug filter mode), except known vector textures. Modules that want smoothing
 * (e.g. `uiIconFrame`) still call `setFilter(LINEAR)` on first use.
 */
export function installNearestTextureDefault(game: Phaser.Game): void {
  game.textures.on(
    Phaser.Textures.Events.ADD,
    (key: string, texture: Phaser.Textures.Texture) => {
      if (SMOOTH_TEXTURE_PREFIXES.some((p) => key.startsWith(p))) return;
      const mode = getDebugWorldTextureFilter(game.registry);
      texture.setFilter(textureFilterForKey(key, mode));
    },
  );
}
