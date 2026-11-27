import type Phaser from "phaser";
import { PALETTE } from "../theme/uiPalette";
import { worldUnit } from "../../config/worldScale";

export type GroundReticleStyle = "fire" | "ice" | "default";

/** Ground-target preview while aiming a spell. */
export class GroundTargetReticle {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private visible = false;
  private radiusWu = 40;
  private style: GroundReticleStyle = "fire";

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(24);
    this.hide();
  }

  showAt(
    x: number,
    y: number,
    radiusWu: number,
    style: GroundReticleStyle = "fire",
  ): void {
    this.visible = true;
    this.radiusWu = radiusWu;
    this.style = style;
    this.redraw(x, y);
  }

  updatePosition(x: number, y: number): void {
    if (!this.visible) return;
    this.redraw(x, y);
  }

  worldGraphics(): Phaser.GameObjects.Graphics {
    return this.gfx;
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
    const stroke =
      this.style === "ice"
        ? PALETTE.sky400
        : this.style === "default"
          ? 0xcbd5e1
          : PALETTE.orange500;
    const fill =
      this.style === "ice"
        ? 0x7dd3fc
        : this.style === "default"
          ? 0x94a3b8
          : PALETTE.orange500;
    const cross =
      this.style === "ice"
        ? PALETTE.sky100
        : this.style === "default"
          ? 0xf8fafc
          : PALETTE.amber400;
    this.gfx.lineStyle(2, stroke, 0.95);
    this.gfx.strokeCircle(x, y, r);
    this.gfx.fillStyle(fill, 0.12);
    this.gfx.fillCircle(x, y, r);
    this.gfx.lineStyle(1, cross, 0.8);
    this.gfx.strokeCircle(x, y, 6);
  }

  static styleForSpellId(spellId: string): GroundReticleStyle {
    if (spellId === "blizzard") return "ice";
    if (
      spellId === "meteor" ||
      spellId === "flamestrike" ||
      spellId === "fire_blast"
    ) {
      return "fire";
    }
    return "default";
  }

  static radiusForSpell(scene: Phaser.Scene, blastRadiusWu: number): number {
    return worldUnit(blastRadiusWu, scene.registry);
  }
}
