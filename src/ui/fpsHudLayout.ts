import type Phaser from "phaser";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { defenseMinimapLayout } from "./defenseMinimap";
import { type SafeInsets } from "./screenLayoutCore";

/** Screen position for the FPS overlay — below minimap (Defense) or header row (Town). */
export function fpsDebugOverlayPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number } {
  const margin = scaleUiX(8);
  const rightX = scene.scale.width - margin - safe.right;

  if (scene.scene.key === "Defense") {
    const mini = defenseMinimapLayout(scene, safe);
    return {
      x: mini.x + mini.width,
      y: mini.y + mini.height + scaleUiY(6),
    };
  }

  const headerBtnH = scaleUiX(36);
  return {
    x: rightX,
    y: safe.top + headerBtnH + scaleUiY(8),
  };
}