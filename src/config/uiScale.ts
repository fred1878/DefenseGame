import { GAME } from "./game";

/** UI scale vs the original 390×844 layout (pure; depends only on `GAME`). */
const LEGACY_WIDTH = 390;
const LEGACY_HEIGHT = 844;

/** Horizontal scale vs original 390-wide layout. */
export function uiScaleX(): number {
  return GAME.width / LEGACY_WIDTH;
}

/** Vertical scale vs original 844-tall layout. */
export function uiScaleY(): number {
  return GAME.height / LEGACY_HEIGHT;
}

export function scaleUiX(px: number): number {
  return Math.round(px * uiScaleX());
}

export function scaleUiY(px: number): number {
  return Math.round(px * uiScaleY());
}
