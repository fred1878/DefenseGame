import Phaser from "phaser";
import { CAST_BAR, DEFENSE_RENDER_DEPTH, type CastBarPhase } from "../config";

/** World-space cast progress bar under the player. */
export class CastBar {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly maxFillWidth: number;
  private phase: CastBarPhase = "windup";

  constructor(scene: Phaser.Scene) {
    const halfW = CAST_BAR.width / 2;
    this.maxFillWidth = CAST_BAR.width - 2;
    this.bg = scene.add
      .rectangle(0, 0, CAST_BAR.width, CAST_BAR.height, CAST_BAR.bgColor, CAST_BAR.bgAlpha)
      .setOrigin(0.5)
      .setStrokeStyle(1, CAST_BAR.windup.borderColor, 0.9)
      .setDepth(DEFENSE_RENDER_DEPTH.castBarBg)
      .setVisible(false);
    this.fill = scene.add
      .rectangle(
        -halfW + 1,
        0,
        0,
        CAST_BAR.height - 2,
        CAST_BAR.windup.fillColor,
        CAST_BAR.fillAlpha,
      )
      .setOrigin(0, 0.5)
      .setDepth(DEFENSE_RENDER_DEPTH.castBarFill)
      .setVisible(false);
  }

  setPhase(phase: CastBarPhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    const palette = CAST_BAR[phase];
    this.fill.setFillStyle(palette.fillColor, CAST_BAR.fillAlpha);
    this.bg.setStrokeStyle(1, palette.borderColor, 0.9);
  }

  setWorldPosition(x: number, y: number): void {
    const barY = y + CAST_BAR.offsetY;
    this.bg.setPosition(x, barY);
    const halfW = CAST_BAR.width / 2;
    this.fill.setPosition(x - halfW + 1, barY);
  }

  setProgress(progress: number): void {
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    this.fill.width = this.maxFillWidth * clamped;
  }

  worldRoots(): Phaser.GameObjects.Rectangle[] {
    return [this.bg, this.fill];
  }

  setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.fill.setVisible(visible);
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
  }
}