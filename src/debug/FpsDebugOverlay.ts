import type Phaser from "phaser";
import { scaleUiX } from "../config/uiScale";
import { fpsDebugOverlayPosition, readSafeInsets } from "../ui/screenLayout";
import { uiTextStyle } from "../ui/uiTextStyle";
import { showFpsCounter } from "./DebugState";

const SMOOTH = 0.12;

/** Screen-space FPS and frame-time readout (toggle via debug menu). */
export class FpsDebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private smoothFps = 0;
  private smoothMs = 0;

  constructor(
    scene: Phaser.Scene,
    registerUiDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ) {
    const safe = readSafeInsets();
    const pos = fpsDebugOverlayPosition(scene, safe);
    this.text = scene.add
      .text(
        pos.x,
        pos.y,
        "",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(14)}px`,
          color: "#a3e635",
          align: "right",
        }),
      )
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(205);
    registerUiDraw?.(this.text);
    this.text.setVisible(false);
  }

  tick(
    registry: Phaser.Data.DataManager,
    delta: number,
    game: Phaser.Game,
  ): void {
    if (!showFpsCounter(registry)) {
      this.text.setVisible(false);
      return;
    }
    const loopFps = game.loop.actualFps;
    const instantFps = delta > 0 ? 1000 / delta : loopFps;
    const fps = Number.isFinite(instantFps) ? instantFps : loopFps;
    this.smoothFps =
      this.smoothFps === 0
        ? fps
        : this.smoothFps + (fps - this.smoothFps) * SMOOTH;
    this.smoothMs =
      this.smoothMs === 0
        ? delta
        : this.smoothMs + (delta - this.smoothMs) * SMOOTH;
    this.text.setVisible(true);
    this.text.setText(
      `${this.smoothFps.toFixed(1)} FPS\n${this.smoothMs.toFixed(1)} ms`,
    );
  }

  destroy(): void {
    this.text.destroy();
  }
}
