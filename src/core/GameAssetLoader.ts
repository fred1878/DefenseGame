import Phaser from "phaser";
import { SFX_ASSETS, SFX_ASSET_ROOT } from "../content/audioAssets";
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
import {
  HOLY_FX_ASSETS,
  HOLY_FX_ROOT,
  registerHolyFxAnimations,
} from "../content/holyFxAssets";
import { configurePixelArtTextures } from "./pixelArtTextures";
import type { DataStore } from "./DataStore";
import { ensureDefenseScene } from "./lazyScenes";

const ASSET_ROOT = "assets";
export const DEFENSE_ASSETS_READY_KEY = "defenseAssetsReady";
export const TOWN_FLUFF_READY_KEY = "townFluffReady";

let defenseLoadPromise: Promise<void> | null = null;
let townFluffPromise: Promise<void> | null = null;

/** First paint Town: building sprites only. */
export function queueMinimalTownBootAssets(
  loader: Phaser.Loader.LoaderPlugin,
  baseUrl: string,
): void {
  loader.setBaseURL(baseUrl);
  for (const { key, file } of TOWN_BUILDING_ASSETS) {
    loader.image(key, `${TOWN_BUILDING_ASSET_ROOT}/${file}`);
  }
}

/** Post–Town-ready: HUD art, spell icons, all SFX (prefetch). */
export function queueTownFluffAssets(
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
  for (const { key, file } of SFX_ASSETS) {
    loader.audio(key, `${SFX_ASSET_ROOT}/${file}`);
  }
}

/** Combat field textures (prefetch / night start). */
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
  for (const entry of SPELL_FX_ASSETS) {
    const root = entry.root ?? "assets/spells/fx";
    loader.image(entry.key, `${root}/${entry.file}`);
  }
  for (const entry of HOLY_FX_ASSETS) {
    loader.spritesheet(entry.key, `${HOLY_FX_ROOT}/${entry.file}`, {
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
    });
  }
}

function afterDefenseAssetsLoaded(scene: Phaser.Scene): void {
  registerHolyFxAnimations(scene);
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

export function ensureTownFluffLoaded(scene: Phaser.Scene): Promise<void> {
  if (scene.game.registry.get(TOWN_FLUFF_READY_KEY)) {
    return Promise.resolve();
  }
  if (townFluffPromise) return townFluffPromise;
  const base = import.meta.env.BASE_URL;
  townFluffPromise = runQueuedLoader(scene, (loader) =>
    queueTownFluffAssets(loader, base),
  ).then(() => {
    scene.game.registry.set(TOWN_FLUFF_READY_KEY, true);
  });
  return townFluffPromise;
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
    afterDefenseAssetsLoaded(scene);
    scene.game.registry.set(DEFENSE_ASSETS_READY_KEY, true);
  });
  return defenseLoadPromise;
}

/** Night, endless, spell sort, or full combat E2E readiness. */
export function ensureNightReady(
  scene: Phaser.Scene,
  store: DataStore,
): Promise<void> {
  const base = import.meta.env.BASE_URL;
  return Promise.all([
    ensureTownFluffLoaded(scene),
    ensureDefenseAssetsLoaded(scene),
    store.ensureDefenseDataLoaded(base),
    ensureDefenseScene(scene.game),
  ]).then(() => undefined);
}

export function resetGameAssetLoaderForTests(): void {
  defenseLoadPromise = null;
  townFluffPromise = null;
}