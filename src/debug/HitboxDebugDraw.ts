import type Phaser from "phaser";
import { PALETTE } from "../ui/theme/uiPalette";
import { drawDebugDisc, drawDebugSegment, drawDebugWedge } from "./debugShapes";
import { arcHitboxHitsTarget } from "../combat/rules/Hitbox";

const FILL = 0xff3333;
const FILL_ALPHA = 0.35;
const LINE = 0xff5555;
const LINE_ALPHA = 0.85;
const OBSTACLE_LINE = PALETTE.sky400;
const OBSTACLE_FILL = PALETTE.sky400;
const OBSTACLE_FILL_ALPHA = 0.12;
const OBSTACLE_LINE_ALPHA = 0.9;
const MELEE_ACTIVATION_FILL = PALETTE.materialYellow200;
const MELEE_ACTIVATION_FILL_ALPHA = 0.07;
const MELEE_ACTIVATION_LINE = PALETTE.materialYellow300;
const MELEE_ACTIVATION_LINE_ALPHA = 0.52;
const MELEE_MAX_RANGE_FILL = PALETTE.materialOrange300;
const MELEE_MAX_RANGE_FILL_ALPHA = 0.07;
const MELEE_MAX_RANGE_LINE = PALETTE.materialOrange500;
const MELEE_MAX_RANGE_LINE_ALPHA = 0.52;
const PROJECTILE_FILL = PALETTE.fuchsia500;
const PROJECTILE_FILL_ALPHA = 0.3;
const PROJECTILE_LINE = PALETTE.fuchsia600;
const PROJECTILE_LINE_ALPHA = 0.75;
const PROJECTILE_HIT_TEST_FILL = 0xf0abfc;
const PROJECTILE_HIT_TEST_ALPHA = 0.1;
const PROJECTILE_BLAST_FILL = PALETTE.fuchsia500;
const PROJECTILE_BLAST_ALPHA = 0.08;
const CHARGE_TOUCH_FILL = PALETTE.cyan400;
const CHARGE_TOUCH_FILL_ALPHA = 0.14;
const CHARGE_TOUCH_LINE = PALETTE.cyan400;
const CHARGE_TOUCH_LINE_ALPHA = 0.65;
const CHARGE_DASH_LINE = PALETTE.cyan300;
const CHARGE_DASH_LINE_ALPHA = 0.8;

/** Clears and redraws combat hitboxes in world space. */
export class HitboxDebugDraw {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(30);
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

  drawCircle(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: FILL,
      fillAlpha: FILL_ALPHA,
      lineWidth: 1.5,
      line: LINE,
      lineAlpha: LINE_ALPHA,
    });
  }

  /** Distance at which melee windup / player auto-melee can start (center-to-center). */
  drawMeleeActivationRange(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: MELEE_ACTIVATION_FILL,
      fillAlpha: MELEE_ACTIVATION_FILL_ALPHA,
      lineWidth: 1.5,
      line: MELEE_ACTIVATION_LINE,
      lineAlpha: MELEE_ACTIVATION_LINE_ALPHA,
    });
  }

  /** Max center-to-center reach of the melee swipe arc (strike `range`). */
  drawMeleeMaxRange(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: MELEE_MAX_RANGE_FILL,
      fillAlpha: MELEE_MAX_RANGE_FILL_ALPHA,
      lineWidth: 1.5,
      line: MELEE_MAX_RANGE_LINE,
      lineAlpha: MELEE_MAX_RANGE_LINE_ALPHA,
    });
  }

  /** Arcade static blocker AABB (world center + size) — matches physics colliders. */
  drawObstacleRect(cx: number, cy: number, w: number, h: number): void {
    const left = cx - w / 2;
    const top = cy - h / 2;
    this.g.fillStyle(OBSTACLE_FILL, OBSTACLE_FILL_ALPHA);
    this.g.fillRect(left, top, w, h);
    this.g.lineStyle(2, OBSTACLE_LINE, OBSTACLE_LINE_ALPHA);
    this.g.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
  }

  /** Moving projectile body (arcade circle). */
  drawProjectileBody(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: PROJECTILE_FILL,
      fillAlpha: PROJECTILE_FILL_ALPHA,
      lineWidth: 1.25,
      line: PROJECTILE_LINE,
      lineAlpha: PROJECTILE_LINE_ALPHA,
    });
  }

  /** Segment-vs-circle test uses `player.radius + slack` at the projectile center. */
  drawProjectilePlayerHitTest(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: PROJECTILE_HIT_TEST_FILL,
      fillAlpha: PROJECTILE_HIT_TEST_ALPHA,
      lineWidth: 1,
      line: PROJECTILE_LINE,
      lineAlpha: PROJECTILE_LINE_ALPHA * 0.6,
    });
  }

  /** Ground blast center (lob in flight / imminent detonation). */
  drawProjectileBlastRadius(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: PROJECTILE_BLAST_FILL,
      fillAlpha: PROJECTILE_BLAST_ALPHA,
      lineWidth: 1.25,
      line: PROJECTILE_LINE,
      lineAlpha: PROJECTILE_LINE_ALPHA * 0.85,
    });
  }

  /** Charger dash contact disk (body + player radius). */
  drawChargeTouchRadius(x: number, y: number, radius: number): void {
    drawDebugDisc(this.g, x, y, radius, {
      fill: CHARGE_TOUCH_FILL,
      fillAlpha: CHARGE_TOUCH_FILL_ALPHA,
      lineWidth: 1.5,
      line: CHARGE_TOUCH_LINE,
      lineAlpha: CHARGE_TOUCH_LINE_ALPHA,
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

  drawMeleeArc(
    originX: number,
    originY: number,
    facing: number,
    range: number,
    arcHalfRad: number,
  ): void {
    const start = facing - arcHalfRad;
    const end = facing + arcHalfRad;
    drawDebugWedge(this.g, originX, originY, range, start, end, {
      fill: FILL,
      fillAlpha: FILL_ALPHA,
      lineWidth: 1.5,
      line: LINE,
      lineAlpha: LINE_ALPHA,
    });
  }

  /** Visual only — mirrors arcHitbox logic for a probe point. */
  static arcWouldHit(
    originX: number,
    originY: number,
    facing: number,
    range: number,
    arcHalfRad: number,
    tx: number,
    ty: number,
    tr: number,
  ): boolean {
    return arcHitboxHitsTarget(
      originX,
      originY,
      facing,
      range,
      arcHalfRad,
      tx,
      ty,
      tr,
    );
  }
}
