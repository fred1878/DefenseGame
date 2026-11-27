import Phaser from "phaser";
import { GAME } from "../../config";
import { uiPartKey } from "../../content/uiParts";
import { bindContainerPress } from "../touch/touchButton";
import { addUiFrame, layoutUiFrame } from "../layout/uiFrame";
import { rerenderTextsWhenFontReady, uiTextStyle } from "../layout/uiTextStyle";

/** What a town name plate shows: name, level pips + "Lv x/y", the tap action. */
export type TownPlateInfo = {
  name: string;
  /** Upgrade / shop level (omit for buildings without levels). */
  level?: number;
  maxLevel?: number;
  action: string;
  /** Green arrow badge: the next upgrade is affordable. */
  upgradeReady?: boolean;
  /** Grey plate with a lock (empty plot). */
  locked?: boolean;
};

export type TownPlate = {
  container: Phaser.GameObjects.Container;
  update: (info: TownPlateInfo) => void;
  /** Move the plate's anchor (centre x, top y); it stays clamped inside the canvas. */
  moveTo: (x: number, y: number) => void;
  /** Make the plate (box + crest) a tap target. */
  makeTappable: (onTap: () => void) => void;
  /** Changes whenever what the plate draws changes (content, position, font re-render). */
  bakeKey: () => string;
  /**
   * Baked plates hide their parts (a render texture draws them); the container stays visible
   * so its hit area keeps working.
   */
  setBaked: (baked: boolean) => void;
};

const NAME_PX = 15;
const ROW_PX = 12;
const PLATE_H = 44;
const LOCKED_H = 38;
const PAD_X = 14;
const EDGE = 6;
const BADGE_R = 11;

const COLOR = {
  name: "#F2C75C",
  lv: "#F4ECDC",
  action: "#E8DCC0",
  lockedName: "#B5AA9A",
  lockedAction: "#9C9282",
} as const;

function outlined(
  scene: Phaser.Scene,
  px: number,
  color: string,
): Phaser.Types.GameObjects.Text.TextStyle {
  return uiTextStyle(scene, {
    fontSize: `${px}px`,
    fontStyle: "bold",
    color,
    stroke: "#0b0908",
    strokeThickness: 3,
  });
}

/** Pip size: wide meters (wall, 8 levels) use smaller gems like the mockup. */
function pipSize(max: number): { w: number; h: number; gap: number } {
  return max > 4 ? { w: 8, h: 8, gap: 2 } : { w: 10, h: 9, gap: 2 };
}

/** Width of the pips / lock / "Lv" / action row: non-empty parts with 6 px gaps. */
function plateRowWidth(widths: readonly number[]): number {
  const parts = widths.filter((w) => w > 0);
  return parts.reduce((a, b) => a + b, 0) + 6 * (parts.length - 1);
}

/** Small padlock before the hint on a locked plate (cleared when not locked). */
function drawLockIcon(
  g: Phaser.GameObjects.Graphics,
  locked: boolean,
  x: number,
  rowY: number,
): void {
  g.clear();
  if (!locked) return;
  g.fillStyle(0x8a8172, 1);
  g.fillRect(x, rowY + 5, 10, 8);
  g.lineStyle(2, 0x8a8172, 1);
  g.strokeRect(x + 2, rowY + 1, 6, 6);
}

/** Green "upgrade ready" arrow badge centred on (bx, by) (cleared when hidden). */
function drawUpgradeBadge(
  g: Phaser.GameObjects.Graphics,
  show: boolean,
  bx: number,
  by: number,
): void {
  g.clear();
  if (!show) return;
  g.fillStyle(0x6fd27f, 1);
  g.fillCircle(bx, by, BADGE_R + 1);
  g.fillStyle(0x0b2a12, 1);
  g.fillCircle(bx, by, BADGE_R);
  g.fillStyle(0x2f9e44, 1);
  g.fillCircle(bx, by, BADGE_R - 2);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(bx - 5, by + 1, bx + 5, by + 1, bx, by - 6);
  g.fillRect(bx - 2, by + 1, 4, 5);
}

/**
 * Crest name plate (Dark Ages UI plate, 2x) centred on `x` with its top at `y`. Kept inside
 * the canvas horizontally. The caller makes it interactive if it should be tappable.
 */
export function createTownPlate(
  scene: Phaser.Scene,
  x: number,
  y: number,
  info: TownPlateInfo,
  depth: number,
): TownPlate {
  const container = scene.add.container(x, y).setDepth(depth);
  let anchorX = x;
  let frame: Phaser.GameObjects.NineSlice | null = null;
  let frameLocked: boolean | null = null;
  const crest = scene.add
    .image(0, -14, uiPartKey("da-plate-crest-top"))
    .setDisplaySize(40, 20);
  const name = scene.add.text(0, 6, "", outlined(scene, NAME_PX, COLOR.name));
  name.setOrigin(0.5, 0);
  const lv = scene.add.text(0, 0, "", outlined(scene, ROW_PX, COLOR.lv));
  lv.setOrigin(0, 0);
  const action = scene.add.text(
    0,
    0,
    "",
    outlined(scene, ROW_PX, COLOR.action),
  );
  action.setOrigin(0, 0);
  const pips: Phaser.GameObjects.Image[] = [];
  const lock = scene.add.graphics();
  const badge = scene.add.graphics();
  container.add([crest, name, lv, action, lock, badge]);

  let current = info;
  let width = 0;
  let height = PLATE_H;
  let baked = false;
  let fontRenders = 0;

  const applyVisibility = (): void => {
    for (const child of container.list) {
      (child as Phaser.GameObjects.Image).setVisible(!baked);
    }
    if (!baked) crest.setVisible(current.locked !== true);
  };

  const ensureFrame = (locked: boolean): void => {
    if (frame && frameLocked === locked) return;
    frame?.destroy();
    frame = addUiFrame(
      scene,
      locked ? "townPlateLocked" : "townPlate",
      0,
      0,
      1,
      1,
    );
    frameLocked = locked;
    if (frame) container.addAt(frame, 0);
  };

  /** Pips, padlock, "Lv x/y" and the action, centred on a row `rowW` wide. */
  const layoutRow = (locked: boolean, rowW: number, lvW: number): void => {
    const max = current.maxLevel ?? 0;
    const ps = pipSize(max);
    const rowY = locked ? 21 : 25;
    let cx = -rowW / 2;
    drawLockIcon(lock, locked, cx, rowY);
    if (locked) cx += 16;
    for (let p = 0; p < pips.length; p++) {
      pips[p]?.setPosition(cx + p * (ps.w + ps.gap) + ps.w / 2, rowY + 6);
    }
    if (max > 0) cx += max * ps.w + (max - 1) * ps.gap + 6;
    lv.setPosition(cx, rowY);
    if (lvW > 0) cx += lvW + 6;
    action.setPosition(cx, rowY);
  };

  /** Upgrade badge, horizontal clamp inside the canvas and the tap area. */
  const layoutEdges = (locked: boolean): void => {
    const showBadge = current.upgradeReady === true && !locked;
    drawUpgradeBadge(badge, showBadge, width / 2 + BADGE_R - 2, -3);
    const extra = showBadge ? BADGE_R * 2 : 0;
    const minX = width / 2 + EDGE;
    const maxX = GAME.width - width / 2 - EDGE - extra;
    container.setX(Math.min(Math.max(anchorX, minX), maxX));
    const hit = container.input?.hitArea as Phaser.Geom.Rectangle | undefined;
    hit?.setTo?.(-width / 2, -16, width, height + 16);
  };

  const layout = (): void => {
    const locked = current.locked === true;
    height = locked ? LOCKED_H : PLATE_H;
    const max = current.maxLevel ?? 0;
    const ps = pipSize(max);
    const pipW = max > 0 ? max * ps.w + (max - 1) * ps.gap : 0;
    const lvW = lv.text ? lv.width : 0;
    const rowW = plateRowWidth([pipW, locked ? 10 : 0, lvW, action.width]);
    width = Math.max(name.width, rowW) + PAD_X * 2;
    ensureFrame(locked);
    const frameId = locked ? "townPlateLocked" : "townPlate";
    if (frame) layoutUiFrame(frame, frameId, -width / 2, 0, width, height);
    name.setPosition(0, locked ? 5 : 7);
    layoutRow(locked, rowW, lvW);
    layoutEdges(locked);
    applyVisibility();
  };

  const update = (next: TownPlateInfo): void => {
    current = next;
    const locked = next.locked === true;
    name.setText(next.name);
    name.setColor(locked ? COLOR.lockedName : COLOR.name);
    action.setText(next.action);
    action.setColor(locked ? COLOR.lockedAction : COLOR.action);
    const max = next.maxLevel ?? 0;
    lv.setText(max > 0 ? `Lv ${next.level ?? 0}/${max}` : "");
    for (const p of pips) p.destroy();
    pips.length = 0;
    const ps = pipSize(max);
    for (let p = 0; p < max; p++) {
      const on = p < (next.level ?? 0);
      const img = scene.add
        .image(0, 0, uiPartKey(on ? "da-gem-gold" : "da-gem-grey"))
        .setDisplaySize(ps.w, ps.h);
      pips.push(img);
      container.add(img);
    }
    layout();
  };

  update(info);
  rerenderTextsWhenFontReady(
    `700 ${NAME_PX}px "Pixelify Sans"`,
    () => [name, lv, action],
    () => {
      fontRenders++;
      layout();
    },
  );

  return {
    container,
    update,
    moveTo: (nx: number, ny: number) => {
      anchorX = nx;
      container.setY(ny);
      layout();
    },
    makeTappable: (onTap: () => void) => {
      container.setInteractive(
        new Phaser.Geom.Rectangle(-width / 2, -16, width, height + 16),
        Phaser.Geom.Rectangle.Contains,
      );
      bindContainerPress(scene, container, onTap);
    },
    bakeKey: () =>
      `${JSON.stringify(current)}@${container.x},${container.y}#${fontRenders}`,
    setBaked: (b: boolean) => {
      baked = b;
      applyVisibility();
    },
  };
}
