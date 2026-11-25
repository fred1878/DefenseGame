import type Phaser from "phaser";
import { collectInteractiveScreenRects } from "../../debug/collectInteractiveScreenRects";
import type { TouchInputDebugDraw } from "../../debug/TouchInputDebugDraw";
import type { ScreenRect } from "../../ui/screenLayout";
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

export function isPointerOverInteractive(
  scene: Phaser.Scene,
  pointer: Phaser.Input.Pointer,
): boolean {
  const hits = scene.input.hitTestPointer(pointer);
  for (const hit of hits) {
    if (hasInteractiveInput(hit as Phaser.GameObjects.GameObject)) return true;
  }
  return false;
}

function hasInteractiveInput(obj: Phaser.GameObjects.GameObject): boolean {
  let node: Phaser.GameObjects.GameObject | null = obj;
  while (node) {
    if (node.input?.enabled) return true;
    const parent: Phaser.GameObjects.Container | null =
      (
        node as Phaser.GameObjects.GameObject & {
          parentContainer?: Phaser.GameObjects.Container;
        }
      ).parentContainer ?? null;
    node = parent;
  }
  return false;
}
