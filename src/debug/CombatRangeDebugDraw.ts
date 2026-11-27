import type Phaser from "phaser";
import { drawDebugDisc, drawDebugSegment, drawDebugWedge } from "./debugShapes";

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
    drawDebugDisc(this.g, x, y, radius, {
      fill: MELEE_ACTIVATION_FILL,
      fillAlpha: MELEE_ACTIVATION_FILL_ALPHA,
      lineWidth: 1.5,
      line: MELEE_ACTIVATION_LINE,
      lineAlpha: MELEE_ACTIVATION_LINE_ALPHA,
    });
  }

  drawMeleeMaxRange(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: MELEE_MAX_RANGE_FILL,
      fillAlpha: MELEE_MAX_RANGE_FILL_ALPHA,
      lineWidth: 1.5,
      line: MELEE_MAX_RANGE_LINE,
      lineAlpha: MELEE_MAX_RANGE_LINE_ALPHA,
    });
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
    drawDebugWedge(this.g, originX, originY, range, start, end, {
      fill: fill,
      fillAlpha: 0.12,
      lineWidth: 1.5,
      line: MELEE_MAX_RANGE_LINE,
      lineAlpha: MELEE_MAX_RANGE_LINE_ALPHA,
    });
  }

  drawProjectileBlastRadius(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: PROJECTILE_BLAST_FILL,
      fillAlpha: PROJECTILE_BLAST_ALPHA,
      lineWidth: 1.25,
      line: PROJECTILE_LINE,
      lineAlpha: 0.75,
    });
  }

  drawChargeDashLine(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    drawDebugSegment(
      this.g,
      fromX,
      fromY,
      toX,
      toY,
      2,
      CHARGE_DASH_LINE,
      CHARGE_DASH_LINE_ALPHA,
    );
  }
}
