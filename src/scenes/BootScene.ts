import Phaser from "phaser";
import { GAME } from "../config";
import { markBoot, measureBoot } from "../core/bootPerf";
import {
  queueMinimalTownBootAssets,
  runQueuedLoader,
} from "../core/GameAssetLoader";
import { DataStore } from "../core/DataStore";
import { getDebugFlags } from "../debug/DebugState";
import { loadSave, persistSave } from "../core/GameState";
import { publishE2E } from "../e2e/e2eGlobal";
import { isE2EEnabled } from "../e2e/e2eMode";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "Boot" });
  }

  preload(): void {
    this.load.setBaseURL(import.meta.env.BASE_URL);
  }

  async create(): Promise<void> {
    const store = new DataStore();
    const baseUrl = import.meta.env.BASE_URL;
    markBoot("defensegame:boot-start");
    try {
      markBoot("defensegame:boot-assets-start");
      const assetsPromise = runQueuedLoader(this, (loader) =>
        queueMinimalTownBootAssets(loader, baseUrl),
      ).then(() => {
        markBoot("defensegame:boot-assets-end");
      });
      markBoot("defensegame:boot-data-start");
      const dataPromise = store.loadTownBoot(baseUrl).then(() => {
        markBoot("defensegame:boot-data-end");
      });
      await Promise.all([assetsPromise, dataPromise]);
      measureBoot(
        "defensegame:boot-assets",
        "defensegame:boot-assets-start",
        "defensegame:boot-assets-end",
      );
      measureBoot(
        "defensegame:boot-data",
        "defensegame:boot-data-start",
        "defensegame:boot-data-end",
      );
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
      publishE2E({ scene: "Boot", ready: false, assetsLoaded: false });
    }
    markBoot("defensegame:town-handoff");
    this.scene.start("Town");
  }
}