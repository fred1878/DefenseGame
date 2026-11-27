import type Phaser from "phaser";
import { collectInteractiveScreenRects } from "../../debug/collectInteractiveScreenRects";
import type { TouchInputDebugDraw } from "../../debug/TouchInputDebugDraw";
import type { ScreenRect } from "../../ui/layout/screenLayout";
import type { TownOverlays } from "./TownOverlays";

/** Interactive UI rects for the touch debug overlay (skips the overlay's own graphics). */
export function collectTownTouchDebugUiRects(
  scene: Phaser.Scene,
  touchDebug: TouchInputDebugDraw,
  overlays?: TownOverlays,
) {
  const skip = [touchDebug.uiGraphics(), touchDebug.worldGraphics()];
  const base = collectInteractiveScreenRects(scene, { skip });
  const extra: ScreenRect[] = overlays?.collectTouchDebugScreenRects() ?? [];
  if (extra.length === 0) return base;
  return [...base, ...extra];
}
