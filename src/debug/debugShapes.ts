import type Phaser from "phaser";

/** Fill + outline style shared by the debug overlay shapes. */
export type DebugShapeStyle = {
  fill: number;
  fillAlpha: number;
  lineWidth: number;
  line: number;
  lineAlpha: number;
};

/** Filled circle with an outline. */
export function drawDebugDisc(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  s: DebugShapeStyle,
): void {
  g.fillStyle(s.fill, s.fillAlpha);
  g.fillCircle(x, y, radius);
  g.lineStyle(s.lineWidth, s.line, s.lineAlpha);
  g.strokeCircle(x, y, radius);
}

/** Filled pie wedge from `start` to `end` (radians) with an outline. */
export function drawDebugWedge(
  g: Phaser.GameObjects.Graphics,
  originX: number,
  originY: number,
  range: number,
  start: number,
  end: number,
  s: DebugShapeStyle,
): void {
  g.fillStyle(s.fill, s.fillAlpha);
  g.beginPath();
  g.moveTo(originX, originY);
  g.arc(originX, originY, range, start, end, false);
  g.closePath();
  g.fillPath();
  g.lineStyle(s.lineWidth, s.line, s.lineAlpha);
  g.beginPath();
  g.moveTo(originX, originY);
  g.arc(originX, originY, range, start, end, false);
  g.closePath();
  g.strokePath();
}

/** Straight line segment. */
export function drawDebugSegment(
  g: Phaser.GameObjects.Graphics,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  color: number,
  alpha: number,
): void {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(fromX, fromY);
  g.lineTo(toX, toY);
  g.strokePath();
}
