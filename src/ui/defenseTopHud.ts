import type Phaser from "phaser";
import { uiPartKey, type UiPartName } from "../content/uiParts";
import { addUiFrame, hasUiPart } from "./uiFrame";
import { uiTextStyle } from "./uiTextStyle";

/** Night status shown in the defense top bar (crest, enemies, wall/hero bars, progress). */
export type DefenseTopHudState = {
  title: string;
  subtitle: string;
  livingEnemies: number;
  wallHp: number;
  wallHpMax: number;
  playerHp: number;
  playerHpMax: number;
  /** "∞" / "(i-frames)" style tags appended to the hero value. */
  heroTag: string;
  spawned: number;
  /** 0 when the run has no fixed spawn plan (endless / e2e). */
  spawnTotal: number;
};

export type DefenseTopHudLayout = {
  top: number;
  height: number;
  width: number;
  pad: number;
  row1Y: number;
  barsY: number;
  barH: number;
  progressY: number;
  enemiesX: number;
  enemiesW: number;
  debugX: number;
  debugW: number;
  debugY: number;
  debugH: number;
};

/** Pure top-bar geometry in logical px (top band = `top .. top + height`). */
export function defenseTopHudLayout(
  width: number,
  safeTop: number,
  bandHeight: number,
): DefenseTopHudLayout {
  const top = safeTop;
  const height = Math.max(96, bandHeight - safeTop);
  const pad = 12;
  const debugW = 72;
  const debugH = 34;
  const enemiesW = 92;
  const debugX = width - pad - debugW;
  const enemiesX = debugX - 8 - enemiesW;
  const row1Y = top + 8;
  const barH = 24;
  const barsY = top + Math.round(height * 0.44);
  const progressY = top + height - 22;
  return {
    top,
    height,
    width,
    pad,
    row1Y,
    barsY,
    barH,
    progressY,
    enemiesX,
    enemiesW,
    debugX,
    debugW,
    debugY: row1Y + 1,
    debugH,
  };
}

/** Clamp a bar ratio into 0..1 (0 for a non-positive max). */
export function barRatio(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.max(0, Math.min(1, value / max));
}

export function formatSpawnProgress(spawned: number, total: number): string {
  if (total <= 0) return "";
  return `${Math.min(spawned, total)}/${total} spawned`;
}

const OUTLINE = "#0b0806";
const GOLD = "#e8c46a";

type Bar = {
  fill: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  innerX: number;
  innerW: number;
  value: Phaser.GameObjects.Text;
};

export type DefenseTopHud = {
  roots: Phaser.GameObjects.GameObject[];
  layout: DefenseTopHudLayout;
  update: (s: DefenseTopHudState) => void;
  setVisible: (visible: boolean) => void;
};

/** WoW-style night status bar inside the defense top band (Dark Ages / Gothic parts). */
export function createDefenseTopHud(
  scene: Phaser.Scene,
  layout: DefenseTopHudLayout,
  depth = 200,
): DefenseTopHud {
  const L = layout;
  const roots: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(go: T): T => {
    (
      go as unknown as Phaser.GameObjects.Components.ScrollFactor
    ).setScrollFactor?.(0);
    (go as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(depth);
    roots.push(go);
    return go;
  };
  const text = (
    x: number,
    y: number,
    size: number,
    color: string,
    originX = 0,
    originY = 0,
  ) =>
    keep(
      scene.add
        .text(
          x,
          y,
          "",
          uiTextStyle(scene, {
            fontSize: `${size}px`,
            color,
            stroke: OUTLINE,
            strokeThickness: size <= 16 ? 2 : 3,
          }),
        )
        .setOrigin(originX, originY),
    );
  const part = (
    name: UiPartName,
    x: number,
    y: number,
    w: number,
    h: number,
  ) =>
    hasUiPart(scene, name)
      ? keep(scene.add.image(x, y, uiPartKey(name)).setDisplaySize(w, h))
      : null;
  const frame = (
    name: Parameters<typeof addUiFrame>[1],
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    const ns = addUiFrame(scene, name, x, y, w, h);
    if (ns) keep(ns);
    return ns;
  };

  // Crest + night title.
  const crestX = L.pad + 24;
  const crestY = L.row1Y + 22;
  part("gp-oval", crestX, crestY, 40, 48);
  part("ed-moon", crestX, crestY, 24, 24);
  const title = text(L.pad + 52, L.row1Y - 1, 26, GOLD);
  const subtitle = text(L.pad + 53, L.row1Y + 28, 13, "#cdbf9f");

  // Enemies-left plate.
  frame("dark", L.enemiesX, L.row1Y, L.enemiesW, 40);
  const enemies = text(
    L.enemiesX + L.enemiesW / 2,
    L.row1Y + 4,
    20,
    "#f4ead8",
    0.5,
    0,
  );
  const enemiesLbl = text(
    L.enemiesX + L.enemiesW / 2,
    L.row1Y + 25,
    12,
    "#cdbf9f",
    0.5,
    0,
  );
  enemiesLbl.setText("ENEMIES");

  // Wall / hero bars.
  const half = Math.floor((L.width - L.pad * 2 - 8) / 2);
  const makeBar = (
    x: number,
    w: number,
    fillPart: UiPartName,
    fallback: number,
    label: string,
    icon: UiPartName | null,
  ): Bar => {
    const y = L.barsY;
    const h = L.barH;
    frame("bar", x, y, w, h);
    const innerX = x + 8;
    const innerW = w - 16;
    const fy = y + 5;
    const fh = h - 10;
    const fill = hasUiPart(scene, fillPart)
      ? keep(
          scene.add
            .image(innerX, fy, uiPartKey(fillPart))
            .setOrigin(0, 0)
            .setDisplaySize(innerW, fh),
        )
      : keep(
          scene.add.rectangle(innerX, fy, innerW, fh, fallback).setOrigin(0, 0),
        );
    let lx = x + 12;
    if (icon) {
      part(icon, x + 14, y + h / 2, 12, 18);
      lx = x + 24;
    }
    text(lx, y + h / 2, 12, "#f4ead8", 0, 0.5).setText(label);
    const value = text(x + w - 12, y + h / 2, 15, "#fdf6e3", 1, 0.5);
    return { fill, innerX, innerW, value };
  };
  const wall = makeBar(L.pad, half, "da-fill-gold-hi", 0xc9a35a, "WALL", null);
  const hero = makeBar(
    L.pad + half + 8,
    half,
    "da-fill-red-hi",
    0xb91c1c,
    "HERO",
    "ed-heart",
  );

  // Night progress.
  const progLbl = text(L.pad + 4, L.progressY + 7, 12, "#cdbf9f", 0, 0.5);
  progLbl.setText("Night progress");
  const progX = L.pad + 118;
  const progW = L.width - L.pad * 2 - 118 - 116;
  frame("bar", progX, L.progressY, progW, 14);
  const progFill = hasUiPart(scene, "da-fill-purple-hi")
    ? keep(
        scene.add
          .image(progX + 8, L.progressY + 4, uiPartKey("da-fill-purple-hi"))
          .setOrigin(0, 0)
          .setDisplaySize(progW - 16, 6),
      )
    : keep(
        scene.add
          .rectangle(progX + 8, L.progressY + 4, progW - 16, 6, 0x7c3aed)
          .setOrigin(0, 0),
      );
  const progText = text(
    L.width - L.pad - 4,
    L.progressY + 7,
    12,
    "#cdbf9f",
    1,
    0.5,
  );

  const setFill = (b: Bar, ratio: number) => {
    const w = Math.round(b.innerW * ratio);
    b.fill.setVisible(w > 0);
    if (w > 0) b.fill.setDisplaySize(w, b.fill.displayHeight);
  };

  const update = (s: DefenseTopHudState) => {
    title.setText(s.title);
    subtitle.setText(s.subtitle);
    enemies.setText(String(s.livingEnemies));
    const wallNow = Math.max(0, Math.floor(s.wallHp));
    const wallMax = Math.max(wallNow, Math.floor(s.wallHpMax));
    wall.value.setText(`${wallNow}/${wallMax}`);
    setFill(wall, barRatio(wallNow, wallMax));
    const hp = Math.max(0, Math.floor(s.playerHp));
    hero.value.setText(`${hp}/${s.playerHpMax}${s.heroTag}`);
    setFill(hero, barRatio(hp, s.playerHpMax));
    const prog = barRatio(s.spawned, s.spawnTotal);
    const pw = Math.round((progW - 16) * prog);
    progFill.setVisible(pw > 0);
    if (pw > 0) progFill.setDisplaySize(pw, 6);
    progText.setText(formatSpawnProgress(s.spawned, s.spawnTotal));
  };

  return {
    roots,
    layout: L,
    update,
    setVisible: (visible) => {
      for (const r of roots) {
        (r as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(
          visible,
        );
      }
    },
  };
}

/** "Endless · Ghoul +1" → title "Endless", subtitle "Ghoul +1"; otherwise the fallback subtitle. */
export function splitHudHeader(
  header: string,
  fallbackSubtitle: string,
): { title: string; subtitle: string } {
  const i = header.indexOf(" · ");
  if (i < 0) return { title: header, subtitle: fallbackSubtitle };
  return { title: header.slice(0, i), subtitle: header.slice(i + 3) };
}
