import type Phaser from "phaser";
import { worldUnit } from "../core/worldPixelScale";

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
        ? 0x38bdf8
        : this.style === "default"
          ? 0xcbd5e1
          : 0xe8b04a;
    const fill =
      this.style === "ice"
        ? 0x7dd3fc
        : this.style === "default"
          ? 0x94a3b8
          : 0xf59e0b;
    const cross =
      this.style === "ice"
        ? 0xe0f2fe
        : this.style === "default"
          ? 0xf8fafc
          : 0xfbbf24;
    // Soft radial glow, dashed ring and a centre pip (mockup aiming state; no banner).
    for (const [k, alpha] of [
      [1, 0.08],
      [0.7, 0.08],
      [0.4, 0.08],
    ] as const) {
      this.gfx.fillStyle(fill, alpha);
      this.gfx.fillCircle(x, y, r * k);
    }
    const dashes = Math.max(12, Math.round(r / 5));
    const step = (Math.PI * 2) / dashes;
    this.gfx.lineStyle(2, stroke, 0.95);
    for (let i = 0; i < dashes; i++) {
      const a0 = i * step;
      this.gfx.beginPath();
      this.gfx.arc(x, y, r, a0, a0 + step * 0.55, false);
      this.gfx.strokePath();
    }
    this.gfx.fillStyle(cross, 0.95);
    this.gfx.fillCircle(x, y, 3);
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
