import Phaser from "phaser";
import { scaleUiX } from "../core/displayScale";
import { TOUCH_BUTTON_RELEASE_SLOP_PX } from "../input/inputTuning";
import { releaseOnSameButton } from "./touchButtonGesture";
import { interactiveObjectScreenRect } from "./touchButtonGeometry";
import { isUiRoundedRect, paintUiRoundedRect } from "./uiRoundedRect";

export type TapOrLongPressCallbacks = {
  onTap: () => void;
  onLongPress: () => void;
  longPressMs: number;
};

export type BgVisual =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Arc
  | Phaser.GameObjects.Ellipse
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Graphics;

export type PressVisual = {
  bg?: BgVisual;
  colors?: { rest: number; pressed: number };
  pressScale?: number;
  textured?: boolean;
};

export const STROKE_PX = Math.max(2, scaleUiX(2));
export const MEDIEVAL_LABEL = {
  color: "#e8dcc8",
  stroke: "#1a1612",
};

export function darkenTint(tint: number, factor = 0.72): number {
  const r = Math.floor(((tint >> 16) & 0xff) * factor);
  const g = Math.floor(((tint >> 8) & 0xff) * factor);
  const b = Math.floor((tint & 0xff) * factor);
  return (r << 16) + (g << 8) + b;
}

export function isImageBg(bg: BgVisual | undefined): bg is Phaser.GameObjects.Image {
  return bg instanceof Phaser.GameObjects.Image;
}

function applyBgTint(bg: BgVisual | undefined, tint: number): void {
  if (!bg) return;
  if (isImageBg(bg)) {
    bg.setTint(tint);
    return;
  }
  if (isUiRoundedRect(bg)) {
    paintUiRoundedRect(bg, tint);
    return;
  }
  if ("setFillStyle" in bg && typeof bg.setFillStyle === "function") {
    bg.setFillStyle(tint, 1);
  }
}

function pressVisualDown(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: PressVisual | undefined,
): void {
  const pressScale = visual?.pressScale ?? 0.9;
  scene.tweens.killTweensOf(container);
  scene.tweens.add({
    targets: container,
    scaleX: pressScale,
    scaleY: pressScale,
    duration: 50,
    ease: "Quad.easeOut",
  });
  if (visual?.bg && visual.colors) {
    applyBgTint(visual.bg, visual.colors.pressed);
  }
}

function pressVisualUp(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: PressVisual | undefined,
): void {
  if (visual?.bg && visual.colors) {
    applyBgTint(visual.bg, visual.colors.rest);
  }
  scene.tweens.add({
    targets: container,
    scaleX: 1,
    scaleY: 1,
    duration: 110,
    ease: "Back.easeOut",
  });
}

function pointerHitsGameObject(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  pointer: Phaser.Input.Pointer,
  slopPx: number,
): boolean {
  const hits = scene.input.hitTestPointer(pointer);
  for (const hit of hits) {
    if (isSameOrDescendant(hit as Phaser.GameObjects.GameObject, obj)) return true;
  }
  const screenRect = interactiveObjectScreenRect(obj);
  if (screenRect) {
    return releaseOnSameButton(screenRect, pointer.x, pointer.y, slopPx);
  }
  return false;
}

function isSameOrDescendant(
  hit: Phaser.GameObjects.GameObject,
  root: Phaser.GameObjects.GameObject,
): boolean {
  if (hit === root) return true;
  if (root instanceof Phaser.GameObjects.Container && root.list.includes(hit)) return true;
  let node: Phaser.GameObjects.GameObject | null = hit;
  while (node) {
    if (node === root) return true;
    const parent: Phaser.GameObjects.Container | null =
      (node as Phaser.GameObjects.GameObject & { parentContainer?: Phaser.GameObjects.Container })
        .parentContainer ?? null;
    node = parent;
  }
  return false;
}

export function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) + (g << 8) + b;
}

/** Press feedback + tap-on-release for any interactive container (town buildings, etc.). */
export function bindContainerPress(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  onPress: () => void,
  pressVisual?: PressVisual,
  activateOn: "pointerdown" | "pointerup" = "pointerdown",
): void {
  bindPress(scene, obj, onPress, pressVisual, activateOn);
}

export function bindPress(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  onPress: () => void,
  pressVisual?: PressVisual,
  _activateOn: "pointerdown" | "pointerup" = "pointerdown",
): void {
  void _activateOn;
  const go = obj as Phaser.GameObjects.GameObject & { input?: { alwaysEnabled?: boolean } };
  if (go.input) go.input.alwaysEnabled = true;

  const slopPx = scaleUiX(TOUCH_BUTTON_RELEASE_SLOP_PX);
  let activePointerId: number | null = null;

  const showPressed = () => {
    if (obj instanceof Phaser.GameObjects.Container) {
      pressVisualDown(scene, obj, pressVisual);
    }
  };

  const clearPressed = () => {
    if (obj instanceof Phaser.GameObjects.Container) {
      pressVisualUp(scene, obj, pressVisual);
    }
  };

  const tryActivate = (pointer: Phaser.Input.Pointer) => {
    if (activePointerId !== null && pointer.id !== activePointerId) return;
    if (!pointerHitsGameObject(scene, obj, pointer, slopPx)) return;
    onPress();
  };

  const onDown = (
    pointer: Phaser.Input.Pointer,
    _lx: number,
    _ly: number,
    event: Phaser.Types.Input.EventData,
  ) => {
    event.stopPropagation();
    activePointerId = pointer.id;
    showPressed();
  };

  const onScenePointerUp = (pointer: Phaser.Input.Pointer) => {
    if (activePointerId === null || pointer.id !== activePointerId) return;
    tryActivate(pointer);
    activePointerId = null;
    clearPressed();
  };

  obj.on("pointerdown", onDown);

  scene.input.on("pointerup", onScenePointerUp);
  scene.input.on("pointerupoutside", onScenePointerUp);
  scene.input.on("pointercancel", onScenePointerUp);

  const cleanup = () => {
    const input = scene.input;
    if (!input) return;
    input.off("pointerup", onScenePointerUp);
    input.off("pointerupoutside", onScenePointerUp);
    input.off("pointercancel", onScenePointerUp);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
}

/** Tap activates on release; long-press fires once without tap. */
export function bindTapOrLongPress(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  callbacks: TapOrLongPressCallbacks,
  pressVisual?: PressVisual,
): void {
  const go = obj as Phaser.GameObjects.GameObject & { input?: { alwaysEnabled?: boolean } };
  if (go.input) go.input.alwaysEnabled = true;

  const slopPx = scaleUiX(TOUCH_BUTTON_RELEASE_SLOP_PX);
  let activePointerId: number | null = null;
  let longPressTimer: number | null = null;
  let longPressFired = false;

  const showPressed = () => {
    if (obj instanceof Phaser.GameObjects.Container) {
      pressVisualDown(scene, obj, pressVisual);
    }
  };

  const clearPressed = () => {
    if (obj instanceof Phaser.GameObjects.Container) {
      pressVisualUp(scene, obj, pressVisual);
    }
  };

  const clearTimer = () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onDown = (
    pointer: Phaser.Input.Pointer,
    _lx: number,
    _ly: number,
    event: Phaser.Types.Input.EventData,
  ) => {
    event.stopPropagation();
    activePointerId = pointer.id;
    longPressFired = false;
    clearTimer();
    longPressTimer = window.setTimeout(() => {
      longPressFired = true;
      callbacks.onLongPress();
    }, callbacks.longPressMs);
    showPressed();
  };

  const onScenePointerUp = (pointer: Phaser.Input.Pointer) => {
    if (activePointerId === null || pointer.id !== activePointerId) return;
    clearTimer();
    if (!longPressFired && pointerHitsGameObject(scene, obj, pointer, slopPx)) {
      callbacks.onTap();
    }
    activePointerId = null;
    clearPressed();
  };

  obj.on("pointerdown", onDown);
  scene.input.on("pointerup", onScenePointerUp);
  scene.input.on("pointerupoutside", onScenePointerUp);
  scene.input.on("pointercancel", onScenePointerUp);

  const cleanup = () => {
    clearTimer();
    const input = scene.input;
    if (!input) return;
    input.off("pointerup", onScenePointerUp);
    input.off("pointerupoutside", onScenePointerUp);
    input.off("pointercancel", onScenePointerUp);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
}