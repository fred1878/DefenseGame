import Phaser from "phaser";
import { GAME } from "../config";
import { DataStore } from "../core/DataStore";
import { loadSave, persistSave } from "../core/GameState";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "Boot" });
  }

  preload(): void {
    this.load.setBaseURL(import.meta.env.BASE_URL);
  }

  async create(): Promise<void> {
    createPlaceholderTextures(this);
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
    const save = loadSave();
    persistSave(save);
    this.registry.set("dataStore", store);
    this.registry.set("save", save);
    this.scene.start("Town");
  }
}

function createPlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x5eead4, 1);
  g.fillCircle(16, 16, 14);
  g.generateTexture("player", 32, 32);
  g.clear();
  g.fillStyle(0xf87171, 1);
  g.fillCircle(14, 14, 12);
  g.generateTexture("enemy_grunt", 28, 28);
  g.clear();
  g.fillStyle(0x3d4451, 1);
  g.fillRect(0, 0, 64, 64);
  g.generateTexture("ground", 64, 64);
  g.clear();
  g.fillStyle(0xfde047, 1);
  g.fillCircle(6, 6, 5);
  g.generateTexture("projectile", 12, 12);
  g.destroy();
}