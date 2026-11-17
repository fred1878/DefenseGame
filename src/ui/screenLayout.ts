import Phaser from "phaser";
import { GAME } from "../config";
import { DEFENSE_SPELL_BAR } from "../config/spellBar";
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

/** Top HUD band height (text lines + minimap clearance). */
export function hudBandHeight(safeTop = 0): number {
  return scaleUiY(96) + safeTop;
}

/** World camera rect between top status band and bottom spell/combat band. */
export type DefensePlayArea = {
  x: number;
  y: number;
  width: number;
  height: number;
  topBandBottom: number;
  bottomBandTop: number;
};

export function defensePlayAreaLayout(
  scene: Phaser.Scene,
  safe: SafeInsets,
): DefensePlayArea {
  const topBandBottom = hudBandHeight(safe.top);
  const bottomBandTop = bottomHudStripLayout(scene, safe).stripTop;
  const x = safe.left;
  const width = scene.scale.width - safe.left - safe.right;
  const height = Math.max(1, bottomBandTop - topBandBottom);
  return {
    x,
    y: topBandBottom,
    width,
    height,
    topBandBottom,
    bottomBandTop,
  };
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
    y: scene.scale.height - margin - safe.bottom - scaleUiY(12),
  };
}

/** Defense: top of right combat column (former MEL stack slot), below minimap band. */
export function combatDebugButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number } {
  const chrome = combatChromeLayout(scene, safe);
  return { x: chrome.debugX, y: chrome.debugY };
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
  debugX: number;
  debugY: number;
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

/** Gothic `action-mode-rect` / AUTO slabs — source art is 64×64; display ~50% wider on X. */
export const COMBAT_MODE_TOGGLE_HEIGHT_DESIGN_PX = 64;
export const COMBAT_MODE_TOGGLE_WIDTH_DESIGN_PX = 96;
/** Narrower combat column so 4×2 spell grid fits beside vertical AUTO/MEL/ATK on 540-wide. */
const DEFENSE_COMBAT_TOGGLE_WIDTH_DESIGN_PX = 48;

export const BOTTOM_HUD_STRIP_H = scaleUiY(118);

/** Fits 2× 4×2 spell grid + horizontal AUTO/MEL row + ATK in the bottom band. */
export function defenseBottomHudStripHeight(): number {
  const bar = DEFENSE_SPELL_BAR;
  const gridH =
    bar.rowCount * bar.slotSizePx +
    (bar.rowCount - 1) * bar.rowGapPx +
    bar.tapPaddingPx * 2;
  const combatStackH =
    scaleUiY(COMBAT_MODE_TOGGLE_HEIGHT_DESIGN_PX) +
    scaleUiX(36) * 2 +
    scaleUiY(14);
  return Math.max(
    BOTTOM_HUD_STRIP_H,
    gridH + scaleUiY(6),
    combatStackH + scaleUiY(6),
  );
}

/** Shared bottom HUD strip geometry (spell row + combat controls sit inside). */
export function bottomHudStripLayout(
  scene: Phaser.Scene,
  safe: SafeInsets,
): BottomHudStrip {
  const stripH = defenseBottomHudStripHeight();
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

/** Minimum inset from canvas left/right edges for spell slot visuals and hit rects. */
export const SPELL_BAR_VIEWPORT_MARGIN_PX = 8;

/** Top edge (Y) of the defense spell grid in screen space. */
export function defenseSpellBarGridTopY(
  scene: Phaser.Scene,
  safe: SafeInsets,
): number {
  const bottomStrip = bottomHudStripLayout(scene, safe);
  const bar = DEFENSE_SPELL_BAR;
  const rowSpan =
    bar.slotSizePx * bar.rowCount + bar.rowGapPx * (bar.rowCount - 1);
  const lowerBias = scaleUiY(6);
  const centerY =
    bottomStrip.stripBottom -
    lowerBias -
    rowSpan +
    bar.slotSizePx / 2 -
    bar.tapPaddingPx / 2;
  return centerY - bar.slotSizePx / 2 - bar.tapPaddingPx;
}

/** First spell slot center X — left-packed, ends before AUTO/MEL/ATK cluster. */
export function spellBarSlotOrigin(
  scene: Phaser.Scene,
  safe: SafeInsets,
  slotCount: number,
  slotSizePx: number,
  slotGapPx: number,
): SpellBarOrigin {
  const chrome = combatChromeLayout(scene, safe);
  const cols = Math.min(slotCount, DEFENSE_SPELL_BAR.columnCount);
  const leftPad = scaleUiX(16) + safe.left;
  const tapPad = DEFENSE_SPELL_BAR.tapPaddingPx;
  const rowWidth = cols * slotSizePx + (cols - 1) * slotGapPx;
  const rowEndMax = chrome.combatClusterLeft - scaleUiX(4);
  const viewportMargin = SPELL_BAR_VIEWPORT_MARGIN_PX;
  const minFirstCenter =
    safe.left + viewportMargin + tapPad + slotSizePx / 2;
  const packedFirst = leftPad + tapPad + slotSizePx / 2;
  const melLimitedFirst = rowEndMax - rowWidth + slotSizePx / 2;
  const firstSlotCenterX = Math.max(
    minFirstCenter,
    Math.min(packedFirst, melLimitedFirst),
  );
  const rowSpan =
    slotSizePx * DEFENSE_SPELL_BAR.rowCount +
    DEFENSE_SPELL_BAR.rowGapPx * (DEFENSE_SPELL_BAR.rowCount - 1);
  const lowerBias = scaleUiY(6);
  const centerY =
    chrome.bottomStrip.stripBottom -
    lowerBias -
    rowSpan +
    slotSizePx / 2 -
    tapPad / 2;
  return {
    centerY,
    firstSlotCenterX,
  };
}

/** Center of spell bar grid cell (rows × columns, left-packed). */
export function spellBarSlotCenter(
  scene: Phaser.Scene,
  safe: SafeInsets,
  slotIndex: number,
  slotSizePx: number,
  slotGapPx: number,
  rowGapPx: number,
): { x: number; y: number } {
  const { firstSlotCenterX, centerY } = spellBarSlotOrigin(
    scene,
    safe,
    DEFENSE_SPELL_BAR.slotCount,
    slotSizePx,
    slotGapPx,
  );
  const col = slotIndex % DEFENSE_SPELL_BAR.columnCount;
  const row = Math.floor(slotIndex / DEFENSE_SPELL_BAR.columnCount);
  const x = firstSlotCenterX + col * (slotSizePx + slotGapPx);
  const y = centerY + row * (slotSizePx + rowGapPx);
  return { x, y };
}

/** Game-space Y of first spell row center (for tests). */
export function expectedSpellBarCenterY(
  scene: Phaser.Scene,
  safe: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 },
): number {
  return spellBarSlotOrigin(
    scene,
    safe,
    DEFENSE_SPELL_BAR.slotCount,
    DEFENSE_SPELL_BAR.slotSizePx,
    DEFENSE_SPELL_BAR.slotGapPx,
  ).centerY;
}

export function combatChromeLayout(
  scene: Phaser.Scene,
  safe: SafeInsets,
): CombatChromeLayout {
  const bottomStrip = bottomHudStripLayout(scene, safe);
  const sideMargin = scaleUiX(4);
  const clusterPullLeft = 0;
  const atkRadius = scaleUiX(36);
  const toggleW = scaleUiX(DEFENSE_COMBAT_TOGGLE_WIDTH_DESIGN_PX);
  const toggleH = scaleUiY(COMBAT_MODE_TOGGLE_HEIGHT_DESIGN_PX);
  const vGap = scaleUiY(4);
  const hGap = scaleUiX(4);
  const atkX =
    scene.scale.width - sideMargin - safe.right - atkRadius - clusterPullLeft;
  const stripInset = scaleUiY(6);
  const btnY = bottomStrip.stripBottom - stripInset - atkRadius;
  let modeY = btnY - atkRadius - vGap - toggleH / 2;
  const pairSpan = toggleW + hGap;
  const autoX = atkX - pairSpan / 2;
  const modeX = atkX + pairSpan / 2;
  const autoY = modeY;
  const autoOffsetY = 0;
  const modeOffsetX = pairSpan;

  const spellTop = defenseSpellBarGridTopY(scene, safe);
  const toggleTop = modeY - toggleH / 2;
  if (toggleTop < spellTop) {
    modeY = spellTop + toggleH / 2 + scaleUiY(1);
  }

  const combatClusterLeft = autoX - toggleW / 2 - scaleUiX(4);
  const hudBand = hudBandHeight(safe.top);
  const w = scene.scale.width;
  const clusterW = w - combatClusterLeft + safe.right;
  const clusterH = bottomStrip.stripH + scaleUiY(8);
  const debugY = modeY - toggleH / 2 - vGap - scaleUiY(18);
  const debugX = atkX;

  return {
    margin: sideMargin,
    atkX,
    btnY,
    atkRadius,
    modeX,
    modeY,
    autoX,
    autoY,
    debugX,
    debugY,
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

/** Town actions stacked from the bottom (0 = start night, then building rows, then spell bar). */
export function townActionButtonY(
  scene: Phaser.Scene,
  safe: SafeInsets,
  fromBottomIndex: number,
): number {
  const firstFromBottom = 96;
  const step = 44;
  return (
    scene.scale.height -
    safe.bottom -
    scaleUiY(firstFromBottom + fromBottomIndex * step)
  );
}

const TOWN_BUILDING_GRID_MAX_HEIGHT = 112;

/** Bottom edge of the TownScene status word-wrap block (`statusText` at scaleUiY(140)). */
export function townBuildingGridStatusBottomY(): number {
  return scaleUiY(140) + scaleUiY(108);
}

/** Foot Y for the bottom grid row (above bottom safe / old Start night band). */
export function townBuildingGridBandBottomFootY(): number {
  return GAME.height - scaleUiY(96);
}

/**
 * Foot Y on the design canvas for a 2×4 building grid row (0 = bottom).
 * Rows are evenly distributed between status bottom and the bottom band.
 */
export function townBuildingGridFootY(fromBottomRow: 0 | 1 | 2 | 3): number {
  const bandBottom = townBuildingGridBandBottomFootY();
  const bandTopFoot =
    townBuildingGridStatusBottomY() + TOWN_BUILDING_GRID_MAX_HEIGHT;
  const span = bandBottom - bandTopFoot;
  const rowFromBottom = fromBottomRow;
  return Math.round(bandBottom - (rowFromBottom * span) / 3);
}

/** Horizontal offset from canvas center to each column (2-wide grid inset from edges). */
const TOWN_BUILDING_GRID_CENTER_OFFSET = scaleUiX(72);

/** Center X for left (0) or right (1) column of the town building grid. */
export function townBuildingGridColumnX(column: 0 | 1): number {
  return column === 0
    ? GAME.width / 2 - TOWN_BUILDING_GRID_CENTER_OFFSET
    : GAME.width / 2 + TOWN_BUILDING_GRID_CENTER_OFFSET;
}

/**
 * Status block top in TownScene (`statusText` origin); keep building sprites below this band.
 * @param maxBuildingHeight tallest slot footprint (witchlight beacons).
 */
export function townBuildingGridClearsStatus(
  fromTopRow: 0 | 1 | 2 | 3,
  maxBuildingHeight: number = TOWN_BUILDING_GRID_MAX_HEIGHT,
): boolean {
  const footY = townBuildingGridFootY(fromTopRow);
  const spriteTop = footY - maxBuildingHeight;
  return spriteTop >= townBuildingGridStatusBottomY();
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