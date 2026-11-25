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

const GAME_SPRITE_KEYS = [
  ...Object.values(PLAYER_TEXTURE),
  ...ENEMY_SPRITE_ASSETS.map((a) => a.key),
    ...COMBAT_FX_ASSETS.map((a) => a.key),
    ...SPELL_FX_ASSETS.map((a) => a.key),
    ...SPELL_ICON_ASSETS.map((a) => a.key),
  ];

/** Nearest-neighbor sampling for world sprites/tiles; UI stays vector (Graphics/Text). */
export function configurePixelArtTextures(scene: Phaser.Scene): void {
  const keys = [
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
  ];
  for (const key of keys) {
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}