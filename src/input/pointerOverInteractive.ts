import type Phaser from "phaser";

/** True when the pointer is over an enabled interactive object (or one inside an interactive container). */
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
