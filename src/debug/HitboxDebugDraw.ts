import Phaser from "phaser";
import { arcHitboxHitsTarget } from "../combat/Hitbox";

const FILL = 0xff3333;
const FILL_ALPHA = 0.35;
const LINE = 0xff5555;
const LINE_ALPHA = 0.85;

/** Clears and redraws combat hitboxes in world space. */
export class HitboxDebugDraw {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(30);
  }

  clear(): void {
    this.g.clear();
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