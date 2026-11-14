import Phaser from "phaser";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { containerScreenRect } from "./touchButton";
import { VIRTUAL_STICK_DRAG_THRESHOLD_PX } from "../input/inputTuning";

export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ScreenRect = { x: number; y: number; width: number; height: number };

const HUD_SIDE = scaleUiX(12);

/** Read CSS env(safe-area-inset-*) in pixels (0 when unsupported). */
export function readSafeInsets(): SafeInsets {
  if (typeof document === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const el = document.createElement("div");
  el.style.cssText = [
    "position: fixed",
    "top: env(safe-area-inset-top, 0px)",
    "right: env(safe-area-inset-right, 0px)",
    "bottom: env(safe-area-inset-bottom, 0px)",
    "left: env(safe-area-inset-left, 0px)",
    "visibility: hidden",
    "pointer-events: none",
  ].join(";");
  document.body.appendChild(el);
  const s = getComputedStyle(el);
  const px = (v: string) => parseFloat(v) || 0;
  const insets: SafeInsets = {
    top: px(s.top),
    right: px(s.right),
    bottom: px(s.bottom),
    left: px(s.left),
  };
  el.remove();
  return insets;
}

/** Top HUD band height (text lines + debug clearance on small screens). */
export function hudBandHeight(safeTop = 0): number {
  return scaleUiY(112) + safeTop;
}

export function hudTextPosition(safe: SafeInsets): { x: number; y: number } {
  return { x: HUD_SIDE + safe.left, y: HUD_SIDE + safe.top };
}

/** Night-end action — right edge, below the HUD band so result copy stays readable. */
export function nightReturnButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number; width: number; height: number } {
  const margin = scaleUiX(12);
  const width = scaleUiX(124);
  const height = scaleUiY(36);
  const band = hudBandHeight(safe.top);
  return {
    x: scene.scale.width - margin - safe.right - width / 2,
    y: band + scaleUiY(10) + height / 2,
    width,
    height,
  };
}

/** Bottom-left debug control — keeps the top HUD readable. */
export function debugButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number } {
  const margin = scaleUiX(12);
  return {
    x: margin + safe.left + scaleUiX(44),
    y: scene.scale.height - margin - safe.bottom - scaleUiY(22),
  };
}

export type CombatChromeLayout = {
  margin: number;
  atkX: number;
  btnY: number;
  atkRadius: number;
  modeOffsetX: number;
  toggleW: number;
  toggleH: number;
  autoOffsetY: number;
  hudBand: number;
  stickRadius: number;
  stickDragThreshold: number;
  rightCluster: ScreenRect;
};

/** Vertical center for the spell hotbar — snug above ATK / stick row. */
export function spellBarCenterY(
  scene: Phaser.Scene,
  safe: SafeInsets,
  slotSizePx: number,
): number {
  const chrome = combatChromeLayout(scene, safe);
  // Visual gap plus spell + ATK tap slops (createTouchCircleButton pad) so hit rects do not overlap.
  const gap =
    scaleUiY(8) + scaleUiX(6) * 2 + scaleUiX(16);
  return chrome.btnY - chrome.atkRadius - gap - slotSizePx / 2;
}

export function combatChromeLayout(
  scene: Phaser.Scene,
  safe: SafeInsets,
): CombatChromeLayout {
  const margin = scaleUiX(48);
  const atkRadius = scaleUiX(44);
  const btnY = scene.scale.height - margin - safe.bottom - atkRadius;
  const atkX = scene.scale.width - margin - safe.right - atkRadius;
  const hudBand = hudBandHeight(safe.top);
  const w = scene.scale.width;
  const h = scene.scale.height;
  const clusterW = scaleUiX(230);
  const clusterH = scaleUiY(270);
  return {
    margin,
    atkX,
    btnY,
    atkRadius,
    modeOffsetX: scaleUiX(100),
    toggleW: scaleUiX(72),
    toggleH: scaleUiY(40),
    autoOffsetY: scaleUiY(96),
    hudBand,
    stickRadius: scaleUiX(56),
    stickDragThreshold: scaleUiX(VIRTUAL_STICK_DRAG_THRESHOLD_PX),
    rightCluster: {
      x: w - clusterW,
      y: h - clusterH - safe.bottom,
      width: clusterW,
      height: clusterH + safe.bottom,
    },
  };
}

/** Town primary actions stacked from the bottom (0 = start night). */
export function townActionButtonY(
  scene: Phaser.Scene,
  safe: SafeInsets,
  fromBottomIndex: 0 | 1 | 2,
): number {
  const bases: Record<0 | 1 | 2, number> = { 0: 120, 1: 210, 2: 290 };
  return scene.scale.height - safe.bottom - scaleUiY(bases[fromBottomIndex]);
}

/** Align Phaser FIT parent with the visible viewport (mobile URL bar / dynamic island). */
export function bindViewportToScale(game: Phaser.Game): () => void {
  const parentEl =
    typeof document !== "undefined"
      ? (document.getElementById(game.config.parent as string) ??
        document.getElementById("game"))
      : null;

  const apply = () => {
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    game.scale.setParentSize(w, h);
    if (parentEl && vv) {
      parentEl.style.position = "fixed";
      parentEl.style.left = `${vv.offsetLeft}px`;
      parentEl.style.top = `${vv.offsetTop}px`;
      parentEl.style.width = `${w}px`;
      parentEl.style.height = `${h}px`;
    }
    game.scale.updateBounds();
  };
  apply();
  window.addEventListener("resize", apply);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
  }
  return () => {
    window.removeEventListener("resize", apply);
    if (vv) {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    }
  };
}

export function cameraWorldPoint(
  camera: Phaser.Cameras.Scene2D.Camera,
  screenX: number,
  screenY: number,
): Phaser.Math.Vector2 {
  return camera.getWorldPoint(screenX, screenY);
}

/** HUD + combat button clusters the virtual stick must never start inside. */
export function buildCombatStickUiMask(
  scene: Phaser.Scene,
  chrome: CombatChromeLayout,
  spellRect: ScreenRect,
  debugContainer: Phaser.GameObjects.Container,
): ScreenRect[] {
  const w = scene.scale.width;
  const pad = scaleUiX(6);
  const debugRect = containerScreenRect(debugContainer, pad);
  return [
    { x: 0, y: 0, width: w, height: chrome.hudBand },
    chrome.rightCluster,
    spellRect,
    debugRect,
  ];
}