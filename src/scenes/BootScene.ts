import Phaser from "phaser";
import { GAME } from "../config";
import { DataStore } from "../core/DataStore";
import { getDebugFlags } from "../debug/DebugState";
import { loadSave, persistSave } from "../core/GameState";
import { GROUND_TILE_KEYS } from "../world/groundTiles";

const ASSET_SPRITES = [
  "player_south",
  "player_east",
  "player_north",
  "player_west",
  "enemy_grunt",
] as const;

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
    createProjectilePlaceholder(this);
    getDebugFlags(this.registry);
    const save = loadSave();
    persistSave(save);
    this.registry.set("dataStore", store);
    this.registry.set("save", save);
    this.scene.start("Town");
  }

  private loadGameAssets(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.load.setBaseURL(import.meta.env.BASE_URL);
      for (const key of ASSET_SPRITES) {
        this.load.image(key, `assets/sprites/${key}.png`);
      }
      for (const key of GROUND_TILE_KEYS) {
        this.load.image(key, `assets/tilesets/ground/${key}.png`);
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.on("loaderror", (file: Phaser.Loader.File) => {
        reject(new Error(`Failed to load asset: ${file.key}`));
      });
      this.load.start();
    });
  }
}

function createProjectilePlaceholder(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xfde047, 1);
  g.fillCircle(6, 6, 5);
  g.generateTexture("projectile", 12, 12);
  g.destroy();
}