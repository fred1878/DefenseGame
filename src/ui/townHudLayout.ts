import type Phaser from "phaser";
import { GAME } from "../config";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { SafeInsets } from "./screenLayoutCore";

/** Town HUD layout: title/status block, header buttons, action stack, building grid. */

const TOWN_TITLE_Y = scaleUiY(60);
const TOWN_TITLE_FONT_PX = scaleUiX(28);
const TOWN_STATUS_BELOW_TITLE_GAP = scaleUiY(6);
const TOWN_STATUS_BLOCK_HEIGHT = scaleUiY(108);

/** Town scene title baseline Y (`Town — Day`, centered). */
export function townTitleY(): number {
  return TOWN_TITLE_Y;
}

/** Top of the status word-wrap block (origin 0.5, 0), just under the title. */
export function townStatusTextTopY(): number {
  return TOWN_TITLE_Y + TOWN_TITLE_FONT_PX / 2 + TOWN_STATUS_BELOW_TITLE_GAP;
}

export function townFullscreenButtonPosition(
  _scene: Phaser.Scene,
  safe: SafeInsets,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: safe.left + width / 2,
    y: safe.top + height / 2,
  };
}

export function townResetSaveButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: scene.scale.width - safe.right - width / 2,
    y: safe.top + height / 2,
  };
}

/**
 * Native-only "Check for update" button, stacked under the fullscreen
 * control in the top-left so it does not appear in the web town layout.
 */
export function townUpdateButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
  _width: number,
  height: number,
  fullscreenWidth: number,
  fullscreenHeight: number,
): { x: number; y: number } {
  const fs = townFullscreenButtonPosition(
    scene,
    safe,
    fullscreenWidth,
    fullscreenHeight,
  );
  const gap = scaleUiY(8);
  return {
    x: fs.x,
    y: fs.y + fullscreenHeight / 2 + gap + height / 2,
  };
}

/** Town: bottom-left debug (away from action stack). */
export function debugButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number } {
  const margin = scaleUiX(12);
  return {
    x: margin + safe.left + scaleUiX(44),
    y: scene.scale.height - margin - safe.bottom - scaleUiY(12),
  };
}
/** Town: bottom-right Gear button (mirrors Debug). */
export function townGearButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number } {
  const margin = scaleUiX(12);
  return {
    x: scene.scale.width - margin - safe.right - scaleUiX(44),
    y: scene.scale.height - margin - safe.bottom - scaleUiY(12),
  };
}
/** Town actions stacked from the bottom (0 = start night, then building rows, then spell bar). */
export function townActionButtonY(
  scene: Phaser.Scene,
  safe: SafeInsets,
  fromBottomIndex: number,
): number {
  const firstFromBottom = 96;
  const step = 44;
  return (
    scene.scale.height -
    safe.bottom -
    scaleUiY(firstFromBottom + fromBottomIndex * step)
  );
}

const TOWN_BUILDING_GRID_MAX_HEIGHT = 112;

/** Bottom edge of the TownScene status word-wrap block (below `townStatusTextTopY`). */
export function townBuildingGridStatusBottomY(): number {
  return townStatusTextTopY() + TOWN_STATUS_BLOCK_HEIGHT;
}

/** Foot Y for the bottom grid row (above bottom safe / old Start night band). */
export function townBuildingGridBandBottomFootY(): number {
  return GAME.height - scaleUiY(96);
}

/**
 * Foot Y on the design canvas for a 2×4 building grid row (0 = bottom).
 * Rows are evenly distributed between status bottom and the bottom band.
 */
export function townBuildingGridFootY(fromBottomRow: 0 | 1 | 2 | 3): number {
  const bandBottom = townBuildingGridBandBottomFootY();
  const bandTopFoot =
    townBuildingGridStatusBottomY() + TOWN_BUILDING_GRID_MAX_HEIGHT;
  const span = bandBottom - bandTopFoot;
  const rowFromBottom = fromBottomRow;
  return Math.round(bandBottom - (rowFromBottom * span) / 3);
}

/** Horizontal offset from canvas center to each column (2-wide grid inset from edges). */
const TOWN_BUILDING_GRID_CENTER_OFFSET = scaleUiX(72);

/** Center X for left (0) or right (1) column of the town building grid. */
export function townBuildingGridColumnX(column: 0 | 1): number {
  return column === 0
    ? GAME.width / 2 - TOWN_BUILDING_GRID_CENTER_OFFSET
    : GAME.width / 2 + TOWN_BUILDING_GRID_CENTER_OFFSET;
}

/**
 * Status block top in TownScene (`statusText` origin); keep building sprites below this band.
 * @param maxBuildingHeight tallest slot footprint (witchlight beacons).
 */
export function townBuildingGridClearsStatus(
  fromTopRow: 0 | 1 | 2 | 3,
  maxBuildingHeight: number = TOWN_BUILDING_GRID_MAX_HEIGHT,
): boolean {
  const footY = townBuildingGridFootY(fromTopRow);
  const spriteTop = footY - maxBuildingHeight;
  return spriteTop >= townBuildingGridStatusBottomY();
}
