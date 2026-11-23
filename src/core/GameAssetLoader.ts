import Phaser from "phaser";
import {
  COMBAT_SFX_ASSETS,
  ECONOMY_SFX_ASSETS,
  SPELL_SFX_ASSETS,
  SFX_ASSET_ROOT,
} from "../content/audioAssets";
import {
  COMBAT_FX_ASSETS,
  ENEMY_SPRITE_ASSETS,
  SPELL_FX_ASSETS,
  DEFENSE_OBSTACLE_ASSETS,
  GROUND_DECOR_ASSETS,
  GROUND_TILE_ASSETS,
  SPELL_ICON_ASSETS,
  SPELL_ICON_ROOT,
  UI_ASSET_ROOT,
  UI_ASSETS,
} from "../content/assets";
import {
  TOWN_BUILDING_ASSET_ROOT,
  TOWN_BUILDING_ASSETS,
} from "../content/townBuildingAssets";
import { configurePixelArtTextures } from "./pixelArtTextures";

const ASSET_ROOT = "assets";
export const DEFENSE_ASSETS_READY_KEY = "defenseAssetsReady";

let defenseLoadPromise: Promise<void> | null = null;

/** Town-first boot: HUD, spell icons, town art, economy SFX only. */
export function queueTownBootAssets(
  loader: Phaser.Loader.LoaderPlugin,
  baseUrl: string,
): void {
  loader.setBaseURL(baseUrl);
  const assetRev = import.meta.env.VITE_BUILD_ID ?? "";
  for (const { key, file } of SPELL_ICON_ASSETS) {
    const q = assetRev ? `?v=${encodeURIComponent(String(assetRev))}` : "";
    loader.image(key, `${SPELL_ICON_ROOT}/${file}${q}`);
  }
  for (const { key, file } of UI_ASSETS) {
    loader.image(key, `${UI_ASSET_ROOT}/${file}`);
  }
  for (const { key, file } of TOWN_BUILDING_ASSETS) {
    loader.image(key, `${TOWN_BUILDING_ASSET_ROOT}/${file}`);
  }
  for (const { key, file } of ECONOMY_SFX_ASSETS) {
    loader.audio(key, `${SFX_ASSET_ROOT}/${file}`);
  }
}

/** Loaded before `DefenseScene` (prefetch in Town or await on night start). */
export function queueDefenseBootAssets(
  loader: Phaser.Loader.LoaderPlugin,
  baseUrl: string,
): void {
  loader.setBaseURL(baseUrl);
  loader.image("player_s", `${ASSET_ROOT}/sprites/player_s.png`);
  loader.image("player_e", `${ASSET_ROOT}/sprites/player_e.png`);
  loader.image("player_n", `${ASSET_ROOT}/sprites/player_n.png`);
  loader.image("player_w", `${ASSET_ROOT}/sprites/player_w.png`);
  for (const { key, file, enemyId } of ENEMY_SPRITE_ASSETS) {
    loader.image(key, `${ASSET_ROOT}/sprites/enemies/${enemyId}/${file}`);
  }
  for (const { key, file } of DEFENSE_OBSTACLE_ASSETS) {
    loader.image(key, `${ASSET_ROOT}/sprites/obstacles/${file}`);
  }
  for (const { key, file } of GROUND_TILE_ASSETS) {
    loader.image(key, `${ASSET_ROOT}/tilesets/ground/${file}`);
  }
  for (const { key, file } of GROUND_DECOR_ASSETS) {
    loader.image(key, `${ASSET_ROOT}/tilesets/ground/decor/${file}`);
  }
  for (const entry of COMBAT_FX_ASSETS) {
    loader.image(entry.key, `${ASSET_ROOT}/combat/fx/${entry.file}`);
  }
  for (const { key, file } of COMBAT_SFX_ASSETS) {
    loader.audio(key, `${SFX_ASSET_ROOT}/${file}`);
  }
  for (const { key, file } of SPELL_SFX_ASSETS) {
    loader.audio(key, `${SFX_ASSET_ROOT}/${file}`);
  }
  for (const entry of SPELL_FX_ASSETS) {
    const root = entry.root ?? "assets/spells/fx";
    loader.image(entry.key, `${root}/${entry.file}`);
  }
}

export function runQueuedLoader(
  scene: Phaser.Scene,
  queue: (loader: Phaser.Loader.LoaderPlugin) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const loader = scene.load;
    queue(loader);
    loader.once(Phaser.Loader.Events.COMPLETE, () => {
      configurePixelArtTextures(scene);
      resolve();
    });
    loader.once(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      (file: { key: string }) => {
        reject(new Error(`Failed to load asset: ${file.key}`));
      },
    );
    if (loader.list.size === 0) {
      configurePixelArtTextures(scene);
      resolve();
      return;
    }
    loader.start();
  });
}

export function ensureDefenseAssetsLoaded(scene: Phaser.Scene): Promise<void> {
  if (scene.game.registry.get(DEFENSE_ASSETS_READY_KEY)) {
    return Promise.resolve();
  }
  if (defenseLoadPromise) return defenseLoadPromise;
  const base = import.meta.env.BASE_URL;
  defenseLoadPromise = runQueuedLoader(scene, (loader) =>
    queueDefenseBootAssets(loader, base),
  ).then(() => {
    scene.game.registry.set(DEFENSE_ASSETS_READY_KEY, true);
  });
  return defenseLoadPromise;
}

/** Test hook: reset singleton between vitest cases. */
export function resetDefenseAssetLoaderForTests(): void {
  defenseLoadPromise = null;
}