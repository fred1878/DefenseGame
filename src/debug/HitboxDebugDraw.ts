import Phaser from "phaser";
import { arcHitboxHitsTarget } from "../combat/Hitbox";

const FILL = 0xff3333;
const FILL_ALPHA = 0.35;
const LINE = 0xff5555;
const LINE_ALPHA = 0.85;
const OBSTACLE_LINE = 0x38bdf8;
const OBSTACLE_FILL = 0x38bdf8;
const OBSTACLE_FILL_ALPHA = 0.12;
const OBSTACLE_LINE_ALPHA = 0.9;
const MELEE_ACTIVATION_FILL = 0xfff59d;
const MELEE_ACTIVATION_FILL_ALPHA = 0.07;
const MELEE_ACTIVATION_LINE = 0xfff176;
const MELEE_ACTIVATION_LINE_ALPHA = 0.32;
const MELEE_MAX_RANGE_FILL = 0xffb74d;
const MELEE_MAX_RANGE_FILL_ALPHA = 0.07;
const MELEE_MAX_RANGE_LINE = 0xff9800;
const MELEE_MAX_RANGE_LINE_ALPHA = 0.32;

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
    this.g.fillStyle(FILL, FILL_ALPHA);
    this.g.fillCircle(x, y, radius);
    this.g.lineStyle(1.5, LINE, LINE_ALPHA);
    this.g.strokeCircle(x, y, radius);
  }

  /** Distance at which melee windup / player auto-melee can start (center-to-center). */
  drawMeleeActivationRange(x: number, y: number, radius: number): void {
    this.g.fillStyle(MELEE_ACTIVATION_FILL, MELEE_ACTIVATION_FILL_ALPHA);
    this.g.fillCircle(x, y, radius);
    this.g.lineStyle(1.25, MELEE_ACTIVATION_LINE, MELEE_ACTIVATION_LINE_ALPHA);
    this.g.strokeCircle(x, y, radius);
  }

  /** Max center-to-center reach of the melee swipe arc (strike `range`). */
  drawMeleeMaxRange(x: number, y: number, radius: number): void {
    this.g.fillStyle(MELEE_MAX_RANGE_FILL, MELEE_MAX_RANGE_FILL_ALPHA);
    this.g.fillCircle(x, y, radius);
    this.g.lineStyle(1.25, MELEE_MAX_RANGE_LINE, MELEE_MAX_RANGE_LINE_ALPHA);
    this.g.strokeCircle(x, y, radius);
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

  drawMeleeArc(
    originX: number,
    originY: number,
    facing: number,
    range: number,
    arcHalfRad: number,
  ): void {
    const start = facing - arcHalfRad;
    const end = facing + arcHalfRad;
    this.g.fillStyle(FILL, FILL_ALPHA);
    this.g.beginPath();
    this.g.moveTo(originX, originY);
    this.g.arc(originX, originY, range, start, end, false);
    this.g.closePath();
    this.g.fillPath();
    this.g.lineStyle(1.5, LINE, LINE_ALPHA);
    this.g.beginPath();
    this.g.moveTo(originX, originY);
    this.g.arc(originX, originY, range, start, end, false);
    this.g.closePath();
    this.g.strokePath();
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
    return arcHitboxHitsTarget(originX, originY, facing, range, arcHalfRad, tx, ty, tr);
  }
}