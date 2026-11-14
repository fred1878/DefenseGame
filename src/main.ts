import Phaser from "phaser";
import { GAME } from "./config";
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
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, TownScene, DefenseScene, DebugMenuScene],
};

async function start(): Promise<void> {
  await ensureFreshBuild();
  const game = new Phaser.Game(config);
  bindViewportToScale(game);
}

void start();