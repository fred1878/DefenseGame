import Phaser from "phaser";
import type { ScreenRect } from "../ui/screenLayout";
import { interactiveObjectScreenRect } from "../ui/touchButton";

export type CollectInteractiveScreenRectsOptions = {
  /** Game objects to omit (e.g. touch-debug overlay graphics). */
  skip?: Iterable<Phaser.GameObjects.GameObject>;
  camera?: Phaser.Cameras.Scene2D.Camera;
};

/**
 * Walk the scene display list and collect screen rects for every enabled
 * interactive hit area (standard Phaser `input` + `hitArea` setup).
 */
export function collectInteractiveScreenRects(
  scene: Phaser.Scene,
  options?: CollectInteractiveScreenRectsOptions,
): ScreenRect[] {
  const skip = new Set(options?.skip ?? []);
  const seen = new WeakSet<Phaser.GameObjects.GameObject>();
  const out: ScreenRect[] = [];
  const camera = options?.camera;

  const pushObject = (go: Phaser.GameObjects.GameObject): void => {
    if (skip.has(go) || seen.has(go)) return;
    const input = go.input;
    if (!go.active || !input?.enabled || !input.hitArea) return;
    const rect = interactiveObjectScreenRect(go, camera);
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    seen.add(go);
    out.push(rect);
  };

  const visit = (go: Phaser.GameObjects.GameObject): void => {
    if (skip.has(go)) return;
    pushObject(go);
    const container = go as Phaser.GameObjects.Container;
    if (!container.list?.length) return;
    for (const child of container.list) {
      visit(child as Phaser.GameObjects.GameObject);
    }
  };

  for (const child of scene.children.list) {
    visit(child as Phaser.GameObjects.GameObject);
  }

  return out;
}