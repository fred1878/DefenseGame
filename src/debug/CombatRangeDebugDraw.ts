import type Phaser from "phaser";

const MELEE_ACTIVATION_FILL = 0xfff59d;
const MELEE_ACTIVATION_FILL_ALPHA = 0.07;
const MELEE_ACTIVATION_LINE = 0xfff176;
const MELEE_ACTIVATION_LINE_ALPHA = 0.52;
const MELEE_MAX_RANGE_FILL = 0xffb74d;
const MELEE_MAX_RANGE_FILL_ALPHA = 0.07;
const MELEE_MAX_RANGE_LINE = 0xff9800;
const MELEE_MAX_RANGE_LINE_ALPHA = 0.52;
const PROJECTILE_BLAST_FILL = 0xd946ef;
const PROJECTILE_BLAST_ALPHA = 0.08;
const PROJECTILE_LINE = 0xc026d3;
const CHARGE_DASH_LINE = 0x67e8f9;
const CHARGE_DASH_LINE_ALPHA = 0.8;

/** Melee / attack reach rings and telegraph arcs — separate from hitbox overlay. */
export class CombatRangeDebugDraw {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(29);
  }

  clear(): void {
    this.g.clear();
  }

  graphics(): Phaser.GameObjects.Graphics {
    return this.g;
  }

  destroy(): void {
    this.g.destroy();
  }

  drawMeleeActivationRange(x: number, y: number, radius: number): void {
    this.g.fillStyle(MELEE_ACTIVATION_FILL, MELEE_ACTIVATION_FILL_ALPHA);
    this.g.fillCircle(x, y, radius);
    this.g.lineStyle(1.5, MELEE_ACTIVATION_LINE, MELEE_ACTIVATION_LINE_ALPHA);
    this.g.strokeCircle(x, y, radius);
  }

  drawMeleeMaxRange(x: number, y: number, radius: number): void {
    this.g.fillStyle(MELEE_MAX_RANGE_FILL, MELEE_MAX_RANGE_FILL_ALPHA);
    this.g.fillCircle(x, y, radius);
    this.g.lineStyle(1.5, MELEE_MAX_RANGE_LINE, MELEE_MAX_RANGE_LINE_ALPHA);
    this.g.strokeCircle(x, y, radius);
  }

  drawMeleeArc(
    originX: number,
    originY: number,
    facing: number,
    range: number,
    arcHalfRad: number,
  ): void {
    const start = facing - arcHalfRad;
    const end = facing + arcHalfRad;
    const fill = 0xffb74d;
    this.g.fillStyle(fill, 0.12);
    this.g.beginPath();
    this.g.moveTo(originX, originY);
    this.g.arc(originX, originY, range, start, end, false);
    this.g.closePath();
    this.g.fillPath();
    this.g.lineStyle(1.5, MELEE_MAX_RANGE_LINE, MELEE_MAX_RANGE_LINE_ALPHA);
    this.g.beginPath();
    this.g.moveTo(originX, originY);
    this.g.arc(originX, originY, range, start, end, false);
    this.g.closePath();
    this.g.strokePath();
  }

  drawProjectileBlastRadius(x: number, y: number, radius: number): void {
    this.g.fillStyle(PROJECTILE_BLAST_FILL, PROJECTILE_BLAST_ALPHA);
    this.g.fillCircle(x, y, radius);
    this.g.lineStyle(1.25, PROJECTILE_LINE, 0.75);
    this.g.strokeCircle(x, y, radius);
  }

  drawChargeDashLine(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    this.g.lineStyle(2, CHARGE_DASH_LINE, CHARGE_DASH_LINE_ALPHA);
    this.g.beginPath();
    this.g.moveTo(fromX, fromY);
    this.g.lineTo(toX, toY);
    this.g.strokePath();
  }
}
