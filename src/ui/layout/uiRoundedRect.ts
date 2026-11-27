import Phaser from "phaser";
import { scaleUiX } from "../../config/uiScale";

export const STROKE_PX = Math.max(2, scaleUiX(2));

/** Uniform corner radius for vector HUD / panel touch controls (screen px). */
export const UI_TOUCH_CORNER_RADIUS_PX = scaleUiX(6);

export type UiRoundedRectMeta = {
  w: number;
  h: number;
  radius: number;
  fill: number;
  stroke: number;
};

export type UiRoundedRect = Phaser.GameObjects.Graphics & {
  __uiRounded: UiRoundedRectMeta;
};

export function isUiRoundedRect(
  bg: Phaser.GameObjects.GameObject,
): bg is UiRoundedRect {
  return (
    bg instanceof Phaser.GameObjects.Graphics &&
    typeof (bg as UiRoundedRect).__uiRounded === "object"
  );
}

export function createUiRoundedRect(
  scene: Phaser.Scene,
  width: number,
  height: number,
  fill: number,
  stroke: number,
  radius = UI_TOUCH_CORNER_RADIUS_PX,
): UiRoundedRect {
  const g = scene.add.graphics({ x: 0, y: 0 }) as UiRoundedRect;
  g.__uiRounded = { w: width, h: height, radius, fill, stroke };
  paintUiRoundedRect(g);
  return g;
}

export function paintUiRoundedRect(
  g: UiRoundedRect,
  fill?: number,
  stroke?: number,
): void {
  const meta = g.__uiRounded;
  if (fill !== undefined) meta.fill = fill;
  if (stroke !== undefined) meta.stroke = stroke;
  const { w, h, radius } = meta;
  g.clear();
  g.fillStyle(meta.fill, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  g.lineStyle(STROKE_PX, meta.stroke, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
}
