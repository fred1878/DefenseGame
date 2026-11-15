import Phaser from "phaser";
import { UI_NINE_SLICE, UI_TEXTURE } from "../content/assets";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { SafeInsets } from "./screenLayout";

export type TownHudChrome = {
  roots: Phaser.GameObjects.GameObject[];
};

/** Tall Gothic panel behind stacked town action buttons. */
export function createTownHudChrome(
  scene: Phaser.Scene,
  _safe: SafeInsets,
  centerY: number,
  panelHeight: number,
  panelWidth: number,
  depth = 40,
): TownHudChrome {
  const slice = UI_NINE_SLICE.panelTall;
  const panel = scene.add.nineslice(
    scene.scale.width / 2,
    centerY,
    UI_TEXTURE.panelTall,
    undefined,
    panelWidth,
    panelHeight,
    slice.left,
    slice.right,
    slice.top,
    slice.bottom,
  );
  panel.setScrollFactor(0).setDepth(depth);
  return { roots: [panel] };
}

export function townActionStackMetrics(
  buttonHeight: number,
  buttonWidth: number,
  /** Center Y of topmost action (smallest screen Y). */
  yTopAction: number,
  /** Center Y of bottommost action (largest screen Y). */
  yBottomAction: number,
): { centerY: number; panelHeight: number; panelWidth: number } {
  const padY = scaleUiY(8);
  const padX = scaleUiX(12);
  const topEdge = yTopAction - buttonHeight / 2 - padY;
  const bottomEdge = yBottomAction + buttonHeight / 2 + padY;
  return {
    centerY: (topEdge + bottomEdge) / 2,
    panelHeight: bottomEdge - topEdge,
    panelWidth: buttonWidth + padX,
  };
}