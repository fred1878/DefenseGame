import type Phaser from "phaser";
import { collectInteractiveScreenRects } from "../../debug/collectInteractiveScreenRects";
import type { TouchInputDebugDraw } from "../../debug/TouchInputDebugDraw";

/** Interactive UI rects for the touch debug overlay (skips the overlay's own graphics). */
export function collectTownTouchDebugUiRects(
  scene: Phaser.Scene,
  touchDebug: TouchInputDebugDraw,
) {
  return collectInteractiveScreenRects(scene, {
    skip: [touchDebug.uiGraphics(), touchDebug.worldGraphics()],
  });
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
      (node as Phaser.GameObjects.GameObject & { parentContainer?: Phaser.GameObjects.Container })
        .parentContainer ?? null;
    node = parent;
  }
  return false;
}
