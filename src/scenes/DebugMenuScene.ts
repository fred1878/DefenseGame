import Phaser from "phaser";
import { GAME } from "../config";
import {
  getDebugFlags,
  setShowHitboxes,
  showHitboxes,
} from "../debug/DebugState";
import { configureSceneInput } from "../input/inputTuning";
import { createTouchButton } from "../ui/touchButton";

export class DebugMenuScene extends Phaser.Scene {
  private hitboxToggle!: ReturnType<typeof createTouchButton>;

  constructor() {
    super({ key: "DebugMenu" });
  }

  create(): void {
    configureSceneInput(this);

    this.add
      .rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.65)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(400)
      .setInteractive();

    this.add
      .text(GAME.width / 2, 120, "Debug", {
        fontSize: "26px",
        color: "#fafafa",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(401);

    const flags = getDebugFlags(this.registry);
    this.hitboxToggle = createTouchButton(
      this,
      GAME.width / 2,
      GAME.height / 2 - 20,
      flags.showHitboxes ? "Hitboxes: ON" : "Hitboxes: OFF",
      () => {
        const next = !showHitboxes(this.registry);
        setShowHitboxes(this.registry, next);
        this.hitboxToggle.setLabel(next ? "Hitboxes: ON" : "Hitboxes: OFF");
      },
      { width: 240, height: 48, depth: 402 },
    );

    createTouchButton(
      this,
      GAME.width / 2,
      GAME.height / 2 + 70,
      "Close",
      () => this.scene.stop("DebugMenu"),
      { width: 160, height: 44, depth: 402, fontSize: "18px" },
    );
  }
}