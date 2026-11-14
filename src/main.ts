import Phaser from "phaser";
import { GAME } from "./config";
import { BootScene } from "./scenes/BootScene";
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
  scene: [BootScene, TownScene, DefenseScene],
};

new Phaser.Game(config);