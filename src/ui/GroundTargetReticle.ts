import Phaser from "phaser";
import { worldUnit } from "../core/worldPixelScale";

/** Ground-target preview while aiming a spell. */
export class GroundTargetReticle {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private visible = false;
  private radiusWu = 40;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(24);
    this.hide();
  }

  showAt(x: number, y: number, radiusWu: number): void {
    this.visible = true;
    this.radiusWu = radiusWu;
    this.redraw(x, y);
  }

  updatePosition(x: number, y: number): void {
    if (!this.visible) return;
    this.redraw(x, y);
  }

  hide(): void {
    this.visible = false;
    this.gfx.clear();
    this.gfx.setVisible(false);
  }

  destroy(): void {
    this.gfx.destroy();
  }

  private redraw(x: number, y: number): void {
    this.gfx.clear();
    this.gfx.setVisible(true);
    const r = this.radiusWu;
    this.gfx.lineStyle(2, 0xf97316, 0.95);
    this.gfx.strokeCircle(x, y, r);
    this.gfx.fillStyle(0xf97316, 0.12);
    this.gfx.fillCircle(x, y, r);
    this.gfx.lineStyle(1, 0xfbbf24, 0.8);
    this.gfx.strokeCircle(x, y, 6);
  }

  static radiusForSpell(scene: Phaser.Scene, blastRadius?: number): number {
    return worldUnit(blastRadius ?? 72, scene.registry);
  }
}