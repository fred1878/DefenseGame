import type Phaser from "phaser";
import { PALETTE } from "../ui/theme/uiPalette";
import { drawDebugDisc, drawDebugSegment, drawDebugWedge } from "./debugShapes";

const MELEE_ACTIVATION_FILL = PALETTE.materialYellow200;
const MELEE_ACTIVATION_FILL_ALPHA = 0.07;
const MELEE_ACTIVATION_LINE = PALETTE.materialYellow300;
const MELEE_ACTIVATION_LINE_ALPHA = 0.52;
const MELEE_MAX_RANGE_FILL = PALETTE.materialOrange300;
const MELEE_MAX_RANGE_FILL_ALPHA = 0.07;
const MELEE_MAX_RANGE_LINE = PALETTE.materialOrange500;
const MELEE_MAX_RANGE_LINE_ALPHA = 0.52;
const CHARGE_DASH_LINE = PALETTE.cyan300;
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
    const fill = PALETTE.materialOrange300;
    drawDebugWedge(this.g, originX, originY, range, start, end, {
      fill: fill,
      fillAlpha: 0.12,
      lineWidth: 1.5,
      line: MELEE_MAX_RANGE_LINE,
      lineAlpha: MELEE_MAX_RANGE_LINE_ALPHA,
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
