import type Phaser from "phaser";
import { GAME } from "./config";
import { markBoot, measureBoot } from "./core/bootPerf";
import { e2eManualReturnFromQuery, isE2EEnabled } from "./e2e/e2eMode";
import { attachE2EGame, seedE2EWindowStub } from "./e2e/installE2E";
import { publishE2E } from "./e2e/e2eGlobal";
import { clampRenderResolution } from "./core/displayScale";
import {
  DEFAULT_WORLD_PIXEL_SCALE,
  WORLD_PIXEL_SCALE_REGISTRY_KEY,
} from "./core/worldPixelScale";
import { bindViewportToScale } from "./ui/screenLayout";
import { BootScene } from "./scenes/BootScene";
import { TownScene } from "./scenes/TownScene";

const parent = "game";
const e2eBuild = import.meta.env.VITE_E2E === "true";

seedE2EWindowStub();

function hideLoadingSplash(): void {
  document.getElementById("loading-splash")?.remove();
}

async function start(): Promise<void> {
  markBoot("defensegame:phaser-import-start");
  const { default: PhaserRuntime } = await import("phaser");
  markBoot("defensegame:phaser-import-end");
  measureBoot(
    "defensegame:phaser-import",
    "defensegame:phaser-import-start",
    "defensegame:phaser-import-end",
  );

  const config: Phaser.Types.Core.GameConfig = {
    type: PhaserRuntime.AUTO,
    parent,
    width: GAME.width,
    height: GAME.height,
    backgroundColor: "#0f1014",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: PhaserRuntime.Scale.FIT,
      autoCenter: PhaserRuntime.Scale.CENTER_BOTH,
      autoRound: true,
      expandParent: true,
      width: GAME.width,
      height: GAME.height,
    },
    render: {
      roundPixels: true,
      antialias: false,
      preserveDrawingBuffer: e2eBuild,
    },
    input: {
      activePointers: 2,
    },
    scene: [BootScene, TownScene],
  };

  markBoot("defensegame:phaser-game-start");
  const game = new PhaserRuntime.Game(config);
  markBoot("defensegame:phaser-game-end");
  measureBoot(
    "defensegame:phaser-game-init",
    "defensegame:phaser-game-start",
    "defensegame:phaser-game-end",
  );
  hideLoadingSplash();

  game.registry.set("renderResolution", clampRenderResolution());
  game.registry.set(WORLD_PIXEL_SCALE_REGISTRY_KEY, DEFAULT_WORLD_PIXEL_SCALE);
  bindViewportToScale(game);
  if (isE2EEnabled()) {
    const e2eTimeScale = (): void => {
      for (const scene of game.scene.scenes) {
        scene.time.timeScale = 2;
      }
    };
    game.events.on(PhaserRuntime.Scenes.Events.CREATE, e2eTimeScale);
    e2eTimeScale();
    if (e2eManualReturnFromQuery()) {
      game.registry.set("e2eManualReturn", true);
    }
    attachE2EGame(game);
    publishE2E({ scene: "Boot", ready: false });
  }
}

void start();