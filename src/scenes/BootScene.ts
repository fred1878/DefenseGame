import Phaser from "phaser";
import { GAME } from "../config";
import { GROUND_TILE_ASSETS } from "../config/assets";
import { DataStore } from "../core/DataStore";
import { getDebugFlags } from "../debug/DebugState";
import { loadSave, persistSave } from "../core/GameState";

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
      loader.image("enemy_grunt", `${ASSET_ROOT}/sprites/enemy_grunt.png`);
      for (const { key, file } of GROUND_TILE_ASSETS) {
        loader.image(key, `${ASSET_ROOT}/tilesets/ground/${file}`);
      }
      createProjectileTexture(this);
      loader.once(Phaser.Loader.Events.COMPLETE, () => resolve());
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

function createProjectileTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists("projectile")) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xfde047, 1);
  g.fillCircle(6, 6, 5);
  g.generateTexture("projectile", 12, 12);
  g.destroy();
}