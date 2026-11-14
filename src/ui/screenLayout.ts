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

/** Town: bottom-left debug (away from action stack). */
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

/** Defense: left edge above bottom HUD strip — clears spell row inside the panel. */
export function combatDebugButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number } {
  const strip = bottomHudStripLayout(scene, safe);
  const margin = scaleUiX(12);
  return {
    x: margin + safe.left + scaleUiX(44),
    y: strip.stripTop - scaleUiY(26),
  };
}

export type BottomHudStrip = {
  stripH: number;
  stripCenterY: number;
  stripTop: number;
  stripBottom: number;
};

export type CombatChromeLayout = {
  margin: number;
  atkX: number;
  btnY: number;
  atkRadius: number;
  modeX: number;
  modeY: number;
  autoX: number;
  autoY: number;
  modeOffsetX: number;
  toggleW: number;
  toggleH: number;
  autoOffsetY: number;
  hudBand: number;
  stickRadius: number;
  stickDragThreshold: number;
  bottomStrip: BottomHudStrip;
  combatClusterLeft: number;
  rightCluster: ScreenRect;
};

export const BOTTOM_HUD_STRIP_H = scaleUiY(140);

/** Shared bottom HUD strip geometry (spell row + combat controls sit inside). */
export function bottomHudStripLayout(
  scene: Phaser.Scene,
  safe: SafeInsets,
): BottomHudStrip {
  const stripH = BOTTOM_HUD_STRIP_H;
  const stripCenterY = scene.scale.height - safe.bottom - stripH / 2;
  return {
    stripH,
    stripCenterY,
    stripTop: stripCenterY - stripH / 2,
    stripBottom: stripCenterY + stripH / 2,
  };
}

/** Vertical center for spell slots — centered in the bottom HUD strip. */
export function spellBarCenterY(
  scene: Phaser.Scene,
  safe: SafeInsets,
  _slotSizePx: number,
): number {
  return bottomHudStripLayout(scene, safe).stripCenterY;
}

export type SpellBarOrigin = {
  centerY: number;
  firstSlotCenterX: number;
};

/** First spell slot center X — left-packed, ends before MEL hit box (combat cluster locked). */
export function spellBarSlotOrigin(
  scene: Phaser.Scene,
  safe: SafeInsets,
  slotCount: number,
  slotSizePx: number,
  slotGapPx: number,
): SpellBarOrigin {
  const chrome = combatChromeLayout(scene, safe);
  const leftPad = scaleUiX(16) + safe.left;
  const tapPad = scaleUiX(4);
  const rowWidth = slotCount * slotSizePx + (slotCount - 1) * slotGapPx;
  const melGuard = scaleUiX(12) + chrome.toggleW / 2 + scaleUiX(10);
  const rowEndMax = chrome.modeX - melGuard;
  const packedFirst = leftPad + tapPad + slotSizePx / 2;
  const fitFirst = rowEndMax - rowWidth + slotSizePx / 2;
  const firstSlotCenterX = Math.max(packedFirst, fitFirst);
  return {
    centerY: chrome.bottomStrip.stripCenterY,
    firstSlotCenterX,
  };
}

/** Game-space Y of spell row center (for tests). */
export function expectedSpellBarCenterY(
  scene: Phaser.Scene,
  safe: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 },
): number {
  return bottomHudStripLayout(scene, safe).stripCenterY;
}

export function combatChromeLayout(
  scene: Phaser.Scene,
  safe: SafeInsets,
): CombatChromeLayout {
  const bottomStrip = bottomHudStripLayout(scene, safe);
  const sideMargin = scaleUiX(6);
  const clusterPullLeft = scaleUiX(28);
  const atkRadius = scaleUiX(38);
  const toggleW = scaleUiX(64);
  const toggleH = scaleUiY(34);
  const atkX =
    scene.scale.width - sideMargin - safe.right - atkRadius - clusterPullLeft;
  const modeX = atkX - atkRadius - scaleUiX(6) - toggleW / 2;
  const rowY = bottomStrip.stripCenterY + scaleUiY(10);
  const btnY = rowY;
  const modeY = rowY;
  const autoX = atkX;
  const autoY = bottomStrip.stripTop + toggleH / 2 + scaleUiY(10);
  const autoOffsetY = btnY - autoY;
  const modeOffsetX = atkX - modeX;
  const combatClusterLeft = modeX - toggleW / 2;
  const hudBand = hudBandHeight(safe.top);
  const w = scene.scale.width;
  const clusterW = w - combatClusterLeft + safe.right;
  const clusterH = bottomStrip.stripH + scaleUiY(8);
  return {
    margin: sideMargin,
    atkX,
    btnY,
    atkRadius,
    modeX,
    modeY,
    autoX,
    autoY,
    modeOffsetX,
    toggleW,
    toggleH,
    autoOffsetY,
    hudBand,
    stickRadius: scaleUiX(56),
    stickDragThreshold: scaleUiX(VIRTUAL_STICK_DRAG_THRESHOLD_PX),
    bottomStrip,
    combatClusterLeft,
    rightCluster: {
      x: combatClusterLeft - scaleUiX(8),
      y: bottomStrip.stripTop - scaleUiY(4),
      width: clusterW + scaleUiX(8),
      height: clusterH,
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
  _spellRect: ScreenRect,
  debugContainer: Phaser.GameObjects.Container,
): ScreenRect[] {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const pad = scaleUiX(6);
  const debugRect = containerScreenRect(debugContainer, pad);
  const strip = chrome.bottomStrip;
  const bottomBand: ScreenRect = {
    x: 0,
    y: Math.max(0, strip.stripTop - scaleUiY(6)),
    width: w,
    height: h - strip.stripTop + scaleUiY(6),
  };
  return [
    { x: 0, y: 0, width: w, height: chrome.hudBand },
    bottomBand,
    debugRect,
  ];
}