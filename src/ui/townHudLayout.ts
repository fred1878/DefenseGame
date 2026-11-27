import type Phaser from "phaser";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { SafeInsets } from "./screenLayoutCore";

/** Town HUD layout: title/status block, header buttons, action stack, building grid. */

/** Title row in the gothic top bar, under the Fullscreen / Reset buttons. */
const TOWN_TITLE_Y = 60;
const TOWN_STATUS_TOP_Y = 76;

/** Town scene title centre Y (`Town — Day`, left of the gold pill). */
export function townTitleY(): number {
  return TOWN_TITLE_Y;
}

/** Top of the status lines (origin 0, 0), just under the title. */
export function townStatusTextTopY(): number {
  return TOWN_STATUS_TOP_Y;
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
/** Talents button: just left of the Gear button (bottom-right). */
export function townTalentsButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number } {
  const gear = townGearButtonPosition(scene, safe);
  return { x: gear.x - scaleUiX(88) - scaleUiX(10), y: gear.y };
}
