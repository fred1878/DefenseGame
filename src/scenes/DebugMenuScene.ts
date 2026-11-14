import Phaser from "phaser";
import {
  getDebugFlags,
  setShowHitboxes,
  showHitboxes,
} from "../debug/DebugState";
import { configureSceneInput } from "../input/inputTuning";
import { createTouchButton } from "../ui/touchButton";
import { hudBandHeight, readSafeInsets } from "../ui/screenLayout";

export class DebugMenuScene extends Phaser.Scene {
  private hitboxToggle!: ReturnType<typeof createTouchButton>;

  constructor() {
    super({ key: "DebugMenu" });
  }

  create(): void {
    configureSceneInput(this);

    const safe = readSafeInsets();
    const w = this.scale.width;
    const h = this.scale.height;
    const panelTop = hudBandHeight(safe.top) + 48;

    this.add
      .rectangle(0, 0, w, h, 0x000000, 0.65)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(400)
      .setInteractive();

    this.add
      .text(w / 2, panelTop, "Debug", {
        fontSize: "26px",
        color: "#fafafa",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(401);

    const flags = getDebugFlags(this.registry);
    this.hitboxToggle = createTouchButton(
      this,
      w / 2,
      h / 2 - 20,
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
      w / 2,
      h / 2 + 70,
      "Close",
      () => this.closeMenu(),
      { width: 160, height: 44, depth: 402, fontSize: "18px" },
    );
  }

  private closeMenu(): void {
    this.game.events.emit("debug-menu-close");
    this.scene.stop("DebugMenu");
  }
}