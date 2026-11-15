import Phaser from "phaser";
import { GAME } from "./config";
import { e2eManualReturnFromQuery, isE2EEnabled } from "./e2e/e2eMode";
import { attachE2EGame, seedE2EWindowStub } from "./e2e/installE2E";
import { publishE2E } from "./e2e/e2eGlobal";
import { clampRenderResolution } from "./core/displayScale";
import {
  DEFAULT_WORLD_PIXEL_SCALE,
  WORLD_PIXEL_SCALE_REGISTRY_KEY,
} from "./core/worldPixelScale";
import { ensureFreshBuild } from "./ensureFreshBuild";
import { bindViewportToScale } from "./ui/screenLayout";
import { BootScene } from "./scenes/BootScene";
import { DebugMenuScene } from "./scenes/DebugMenuScene";
import { DefenseScene } from "./scenes/DefenseScene";
import { TownScene } from "./scenes/TownScene";

const parent = "game";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    expandParent: true,
    width: GAME.width,
    height: GAME.height,
  },
  render: {
    roundPixels: true,
    antialias: true,
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, TownScene, DefenseScene, DebugMenuScene],
};

seedE2EWindowStub();

async function start(): Promise<void> {
  await ensureFreshBuild();
  const game = new Phaser.Game(config);
  game.registry.set("renderResolution", clampRenderResolution());
  game.registry.set(WORLD_PIXEL_SCALE_REGISTRY_KEY, DEFAULT_WORLD_PIXEL_SCALE);
  bindViewportToScale(game);
  if (isE2EEnabled()) {
    const e2eTimeScale = (): void => {
      for (const scene of game.scene.scenes) {
        scene.time.timeScale = 2;
      }
    };
    game.events.on(Phaser.Scenes.Events.CREATE, e2eTimeScale);
    e2eTimeScale();
    if (e2eManualReturnFromQuery()) {
      game.registry.set("e2eManualReturn", true);
    }
    attachE2EGame(game);
    publishE2E({ scene: "Boot", ready: false });
  }
}

void start();