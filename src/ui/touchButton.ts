import Phaser from "phaser";
import { scaleUiX, uiTextResolution } from "../core/displayScale";
import {
  parseUiFontSizePx,
  UI_FONT_FAMILY,
  uiTextStrokeAllowed,
} from "./uiTextStyle";
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
  /** Pixel-art frame texture (nearest filtered in Boot). */
  frameTextureKey?: string;
  /** Use `pointerup` for actions that require it (e.g. Fullscreen API). */
  activateOn?: "pointerdown" | "pointerup";
  /** When set, caller wires press handling (e.g. long-press). */
  skipPressBinding?: boolean;
};

export type TouchToggleOptions = {
  frameTextureKey?: string;
  /** Multiply tint on the frame image when toggled on (textured buttons). */
  onBgTint?: number;
  offBgTint?: number;
  onTextColor?: string;
  offTextColor?: string;
};

function darkenTint(tint: number, factor = 0.72): number {
  const r = Math.floor(((tint >> 16) & 0xff) * factor);
  const g = Math.floor(((tint >> 8) & 0xff) * factor);
  const b = Math.floor((tint & 0xff) * factor);
  return (r << 16) + (g << 8) + b;
}

export type TouchButtonHandle = {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
};

export type TapOrLongPressCallbacks = {
  onTap: () => void;
  onLongPress: () => void;
  longPressMs: number;
};

type BgVisual =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Arc
  | Phaser.GameObjects.Ellipse
  | Phaser.GameObjects.Image;

type PressVisual = {
  bg?: BgVisual;
  colors?: { rest: number; pressed: number };
  pressScale?: number;
  textured?: boolean;
};

const STROKE_PX = Math.max(2, scaleUiX(2));
const MEDIEVAL_LABEL = {
  color: "#e8dcc8",
  stroke: "#1a1612",
};

function isImageBg(bg: BgVisual | undefined): bg is Phaser.GameObjects.Image {
  return bg instanceof Phaser.GameObjects.Image;
}

function applyBgTint(bg: BgVisual | undefined, tint: number): void {
  if (!bg) return;
  if (isImageBg(bg)) {
    bg.setTint(tint);
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

function darkenColor(color: number, factor: number): number {
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
    scene.input.off("pointerup", onScenePointerUp);
    scene.input.off("pointerupoutside", onScenePointerUp);
    scene.input.off("pointercancel", onScenePointerUp);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
}

function createButtonBackground(
  scene: Phaser.Scene,
  width: number,
  height: number,
  fill: number,
  stroke: number,
  frameTextureKey?: string,
): BgVisual {
  if (frameTextureKey && scene.textures.exists(frameTextureKey)) {
    return scene.add
      .image(0, 0, frameTextureKey)
      .setDisplaySize(width, height);
  }
  return scene.add
    .rectangle(0, 0, width, height, fill, 1)
    .setStrokeStyle(STROKE_PX, stroke);
}

function labelStyle(scene: Phaser.Scene, fontSize: string, textured: boolean) {
  const base: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: UI_FONT_FAMILY,
    fontSize,
    resolution: uiTextResolution(scene),
  };
  if (!textured) return base;
  const px = parseUiFontSizePx(fontSize);
  if (!uiTextStrokeAllowed(px)) {
    return { ...base, color: MEDIEVAL_LABEL.color };
  }
  return {
    ...base,
    color: MEDIEVAL_LABEL.color,
    stroke: MEDIEVAL_LABEL.stroke,
    strokeThickness: Math.max(2, scaleUiX(2)),
  };
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
  const textured = Boolean(options.frameTextureKey);

  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(sf);
  const bg = createButtonBackground(
    scene,
    options.width,
    options.height,
    fill,
    stroke,
    options.frameTextureKey,
  );
  const text = scene.add
    .text(0, 0, label, labelStyle(scene, fontSize, textured))
    .setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  // Container input uses displayOrigin (width/2, height/2); top-left hit area keeps center on visuals.
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  const colors = textured
    ? { rest: 0xffffff, pressed: darkenTint(0xffffff, 0.68) }
    : { rest: fill, pressed: darkenColor(fill, 0.72) };
  if (!options.skipPressBinding) {
    bindPress(scene, container, onPress, { bg, colors, pressScale: 0.88, textured }, activateOn);
  }

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
  toggleOptions?: TouchToggleOptions,
): {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
  setOn: (on: boolean) => void;
  getOn: () => boolean;
} {
  const pad = scaleUiX(12);
  const hitW = width + pad * 2;
  const hitH = height + pad * 2;
  const frameKey = toggleOptions?.frameTextureKey;
  const textured = Boolean(frameKey);

  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(0);
  const bg = createButtonBackground(scene, width, height, 0x3f3f46, 0x71717a, frameKey);
  const labelPx = textured ? scaleUiX(15) : scaleUiX(14);
  const text = scene.add
    .text(0, 0, initialLabel, {
      ...labelStyle(scene, `${labelPx}px`, textured),
    })
    .setOrigin(0.5)
    .setAlign("center");
  if (initialLabel.includes("\n")) {
    text.setFontSize(scaleUiX(12));
    text.setLineSpacing(scaleUiX(-2));
  }
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  const onBgTint = toggleOptions?.onBgTint ?? 0xb8e0a8;
  const offBgTint = toggleOptions?.offBgTint ?? 0xffffff;
  const onTextColor = toggleOptions?.onTextColor ?? "#d9f99d";
  const offTextColor = toggleOptions?.offTextColor ?? MEDIEVAL_LABEL.color;

  const colors = textured
    ? { rest: offBgTint, pressed: darkenTint(offBgTint) }
    : { rest: 0x3f3f46, pressed: 0x27272a };
  bindPress(scene, container, onPress, { bg, colors, pressScale: 0.9, textured });

  let onState = false;

  const applyOn = (on: boolean) => {
    onState = on;
    if (textured && isImageBg(bg)) {
      const rest = on ? onBgTint : offBgTint;
      colors.rest = rest;
      colors.pressed = darkenTint(rest);
      bg.setTint(rest);
      text.setColor(on ? onTextColor : offTextColor);
      return;
    }
    colors.rest = on ? 0x15803d : 0x3f3f46;
    colors.pressed = darkenColor(colors.rest, 0.75);
    if (!isImageBg(bg)) {
      bg.setFillStyle(colors.rest, 1);
      bg.setStrokeStyle(STROKE_PX, on ? 0x4ade80 : 0x71717a);
    }
    text.setColor(on ? "#bbf7d0" : "#e4e4e7");
  };

  return {
    container,
    setLabel: (label: string) => {
      text.setText(label);
      if (label.includes("\n")) {
        text.setFontSize(scaleUiX(12));
        text.setLineSpacing(scaleUiX(-2));
      }
    },
    setOn: applyOn,
    getOn: () => onState,
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
  frameTextureKey?: string,
): Phaser.GameObjects.Container {
  const pad = scaleUiX(16);
  const hitR = radius + pad;
  const diameter = radius * 2;
  const textured = Boolean(frameTextureKey);
  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(0);

  let bg: BgVisual;
  if (frameTextureKey && scene.textures.exists(frameTextureKey)) {
    bg = scene.add.image(0, 0, frameTextureKey).setDisplaySize(diameter, diameter);
  } else {
    bg = scene.add.circle(0, 0, radius, 0xea580c, 1).setStrokeStyle(STROKE_PX, 0xfdba74);
  }
  const text = scene.add
    .text(0, 0, label, {
      ...labelStyle(scene, `${scaleUiX(18)}px`, textured),
    })
    .setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitR * 2, hitR * 2);
  container.setInteractive(
    new Phaser.Geom.Circle(hitR, hitR, hitR),
    Phaser.Geom.Circle.Contains,
  );
  const colors = textured
    ? { rest: 0xffffff, pressed: darkenTint(0xffffff, 0.65) }
    : { rest: 0xea580c, pressed: 0xc2410c };
  bindPress(scene, container, onPress, { bg, colors, pressScale: 0.9, textured });
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