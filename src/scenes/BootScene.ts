import Phaser from "phaser";
import { GAME } from "../config";
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
import { DataStore } from "../core/DataStore";
import { getDebugFlags } from "../debug/DebugState";
import { loadSave, persistSave } from "../core/GameState";
import { configurePixelArtTextures } from "../core/pixelArtTextures";
import { markE2EAssetsLoaded } from "../e2e/installE2E";
import { publishE2E } from "../e2e/e2eGlobal";
import { isE2EEnabled } from "../e2e/e2eMode";

const ASSET_ROOT = "assets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "Boot" });
  }

  preload(): void {
    this.load.setBaseURL(import.meta.env.BASE_URL);
  }

  async create(): Promise<void> {
    await this.loadGameAssets();
    const store = new DataStore();
    try {
      await store.loadAll(import.meta.env.BASE_URL);
    } catch (err) {
      this.add
        .text(GAME.width / 2, GAME.height / 2, "Failed to load data", {
          color: "#ff6b6b",
        })
        .setOrigin(0.5);
      console.error(err);
      return;
    }
    getDebugFlags(this.registry);
    const save = loadSave();
    persistSave(save);
    this.registry.set("dataStore", store);
    this.registry.set("save", save);
    if (isE2EEnabled()) {
      markE2EAssetsLoaded(this.game);
      publishE2E({ scene: "Boot", ready: false, assetsLoaded: true });
    }
    this.scene.start("Town");
  }

  private loadGameAssets(): Promise<void> {
    return new Promise((resolve, reject) => {
      const base = import.meta.env.BASE_URL;
      const loader = this.load.setBaseURL(base);
      loader.image("player_s", `${ASSET_ROOT}/sprites/player_s.png`);
      loader.image("player_e", `${ASSET_ROOT}/sprites/player_e.png`);
      loader.image("player_n", `${ASSET_ROOT}/sprites/player_n.png`);
      loader.image("player_w", `${ASSET_ROOT}/sprites/player_w.png`);
      for (const { key, file } of ENEMY_SPRITE_ASSETS) {
        loader.image(key, `${ASSET_ROOT}/sprites/${file}`);
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
      loader.once(Phaser.Loader.Events.COMPLETE, () => {
        configurePixelArtTextures(this);
        resolve();
      });
      loader.once(
        Phaser.Loader.Events.FILE_LOAD_ERROR,
        (file: { key: string }) => {
          reject(new Error(`Failed to load asset: ${file.key}`));
        },
      );
      if (loader.list.size === 0) {
        resolve();
        return;
      }
      loader.start();
    });
  }
}