import Phaser from "phaser";
import { clampRenderResolution, scaleUiX } from "../core/displayScale";
import { TOUCH_BUTTON_RELEASE_SLOP_PX } from "../input/inputTuning";
import { releaseOnSameButton } from "./touchButtonGesture";

export type TouchButtonRectOptions = {
  width: number;
  height: number;
  depth?: number;
  scrollFactor?: number;
  tapPadding?: number;
  fontSize?: string;
  fillColor?: number;
  strokeColor?: number;
  /** Use `pointerup` for actions that require it (e.g. Fullscreen API). */
  activateOn?: "pointerdown" | "pointerup";
};

export type TouchButtonHandle = {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
};

type PressVisual = {
  bg?: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc | Phaser.GameObjects.Ellipse;
  colors?: { rest: number; pressed: number };
  pressScale?: number;
};

const STROKE_PX = Math.max(2, scaleUiX(2));

function textResolution(scene: Phaser.Scene): number {
  return (scene.registry.get("renderResolution") as number | undefined) ?? clampRenderResolution();
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
    visual.bg.setFillStyle(visual.colors.pressed, 1);
  }
}

function pressVisualUp(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual: PressVisual | undefined,
): void {
  if (visual?.bg && visual.colors) {
    visual.bg.setFillStyle(visual.colors.rest, 1);
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

function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) + (g << 8) + b;
}

function bindPress(
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

  /** Scene-level so drag-off releases always clear pressed state (object `pointerupoutside` can miss). */
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
    scene.input.off("pointerup", onScenePointerUp);
    scene.input.off("pointerupoutside", onScenePointerUp);
    scene.input.off("pointercancel", onScenePointerUp);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
}

/**
 * Mobile-first button — interactive hit on the container (zones-in-containers miss hits on mobile).
 */
export function createTouchButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onPress: () => void,
  options: TouchButtonRectOptions,
): TouchButtonHandle {
  const depth = options.depth ?? 100;
  const sf = options.scrollFactor ?? 0;
  const pad = options.tapPadding ?? scaleUiX(20);
  const hitW = options.width + pad * 2;
  const hitH = options.height + pad * 2;
  const fontSize = options.fontSize ?? `${scaleUiX(20)}px`;
  const fill = options.fillColor ?? 0x3b82f6;
  const stroke = options.strokeColor ?? 0x60a5fa;
  const activateOn = options.activateOn ?? "pointerdown";

  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(sf);
  const bg = scene.add
    .rectangle(0, 0, options.width, options.height, fill, 1)
    .setStrokeStyle(STROKE_PX, stroke);
  const text = scene.add
    .text(0, 0, label, { fontSize, resolution: textResolution(scene) })
    .setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  // Container input uses displayOrigin (width/2, height/2); top-left hit area keeps center on visuals.
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  const colors = { rest: fill, pressed: darkenColor(fill, 0.72) };
  bindPress(scene, container, onPress, { bg, colors, pressScale: 0.88 }, activateOn);

  return {
    container,
    setLabel: (next: string) => text.setText(next),
  };
}

export function createTouchToggleButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  initialLabel: string,
  width: number,
  height: number,
  onPress: () => void,
  depth = 200,
): { container: Phaser.GameObjects.Container; setLabel: (text: string) => void; setOn: (on: boolean) => void } {
  const pad = scaleUiX(12);
  const hitW = width + pad * 2;
  const hitH = height + pad * 2;

  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(0);
  const bg = scene.add
    .rectangle(0, 0, width, height, 0x3f3f46, 1)
    .setStrokeStyle(STROKE_PX, 0x71717a);
  const text = scene.add
    .text(0, 0, initialLabel, {
      fontSize: `${scaleUiX(14)}px`,
      resolution: textResolution(scene),
    })
    .setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  const colors = { rest: 0x3f3f46, pressed: 0x27272a };
  bindPress(scene, container, onPress, { bg, colors, pressScale: 0.9 });

  return {
    container,
    setLabel: (label: string) => text.setText(label),
    setOn: (on: boolean) => {
      colors.rest = on ? 0x15803d : 0x3f3f46;
      colors.pressed = darkenColor(colors.rest, 0.75);
      bg.setFillStyle(colors.rest, 1);
      bg.setStrokeStyle(STROKE_PX, on ? 0x4ade80 : 0x71717a);
    },
  };
}

export function createTouchCircleButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  radius: number,
  onPress: () => void,
  depth = 150,
): Phaser.GameObjects.Container {
  const pad = scaleUiX(16);
  const hitR = radius + pad;
  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(0);
  const bg = scene.add
    .circle(0, 0, radius, 0xea580c, 1)
    .setStrokeStyle(STROKE_PX, 0xfdba74);
  const text = scene.add
    .text(0, 0, label, {
      fontSize: `${scaleUiX(18)}px`,
      resolution: textResolution(scene),
    })
    .setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitR * 2, hitR * 2);
  container.setInteractive(
    new Phaser.Geom.Circle(hitR, hitR, hitR),
    Phaser.Geom.Circle.Contains,
  );
  const colors = { rest: 0xea580c, pressed: 0xc2410c };
  bindPress(scene, container, onPress, { bg, colors, pressScale: 0.9 });
  return container;
}

type TransformGo = Phaser.GameObjects.GameObject & {
  getWorldTransformMatrix?: (
    tempMatrix?: Phaser.GameObjects.Components.TransformMatrix,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ) => Phaser.GameObjects.Components.TransformMatrix;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  displayOriginX: number;
  displayOriginY: number;
  input?: {
    hitArea?: Phaser.Geom.Rectangle | Phaser.Geom.Circle;
  };
};

/**
 * Screen/canvas bounds of an interactive hit area — matches InputManager hit tests (same space as `pointer.x/y`).
 */
export function interactiveObjectScreenRect(
  obj: Phaser.GameObjects.GameObject,
  camera?: Phaser.Cameras.Scene2D.Camera,
): { x: number; y: number; width: number; height: number } | null {
  const go = obj as TransformGo;
  const input = go.input;
  if (!input?.hitArea) return null;
  const scene = obj.scene;
  if (!scene) return null;
  const cam = camera ?? scene.cameras.main;

  let wx = go.x;
  let wy = go.y;
  let scaleX = go.scaleX;
  let scaleY = go.scaleY;
  if (go.getWorldTransformMatrix) {
    const matrix = new Phaser.GameObjects.Components.TransformMatrix();
    go.getWorldTransformMatrix(matrix);
    wx = matrix.tx;
    wy = matrix.ty;
    scaleX = matrix.scaleX;
    scaleY = matrix.scaleY;
  }

  const shape = input.hitArea;
  const sfx = (go as { scrollFactorX?: number }).scrollFactorX ?? 1;
  const sfy = (go as { scrollFactorY?: number }).scrollFactorY ?? 1;

  const worldToPointer = (worldX: number, worldY: number): { x: number; y: number } => {
    // HUD / touch UI uses scrollFactor 0 — same canvas coords as pointer.x/y.
    if (sfx === 0 && sfy === 0) {
      return { x: worldX, y: worldY };
    }
    const world = new Phaser.Math.Vector2(worldX, worldY);
    const screen = cam.getWorldPoint(world.x, world.y);
    return { x: screen.x, y: screen.y };
  };

  if (shape instanceof Phaser.Geom.Circle) {
    const offsetX = shape.x - shape.radius;
    const offsetY = shape.y - shape.radius;
    const worldX = wx + (offsetX - go.displayOriginX) * scaleX;
    const worldY = wy + (offsetY - go.displayOriginY) * scaleY;
    const size = shape.radius * 2 * Math.abs(scaleX);
    const topLeft = worldToPointer(worldX, worldY);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: size,
      height: size,
    };
  }

  const rect = shape as Phaser.Geom.Rectangle;
  const worldX = wx + (rect.x - go.displayOriginX) * scaleX;
  const worldY = wy + (rect.y - go.displayOriginY) * scaleY;
  const hitW = rect.width * Math.abs(scaleX);
  const hitH = rect.height * Math.abs(scaleY);
  const tl = worldToPointer(worldX, worldY);
  const br = worldToPointer(worldX + hitW, worldY + hitH);
  return {
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    width: Math.abs(br.x - tl.x),
    height: Math.abs(br.y - tl.y),
  };
}

/** Screen-space bounds for stick masking (interactive hit box in canvas coords). */
export function containerScreenRect(
  container: Phaser.GameObjects.Container,
  pad = 0,
): { x: number; y: number; width: number; height: number } {
  const fromInput = interactiveObjectScreenRect(container);
  const b = fromInput ?? container.getBounds();
  return {
    x: b.x - pad,
    y: b.y - pad,
    width: b.width + pad * 2,
    height: b.height + pad * 2,
  };
}

/** True while press-scale tween holds the button visually down (e2e assertions). */
export function isTouchButtonVisuallyPressed(
  container: Phaser.GameObjects.Container,
): boolean {
  return container.scaleX < 0.94 || container.scaleY < 0.94;
}

/** Screen-space hit test for UI that must block the movement stick. */
export function pointerInScreenRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}