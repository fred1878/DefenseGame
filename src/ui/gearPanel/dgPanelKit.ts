/**
 * Small drawing kit for the DG Theme panels (Blacksmith / Trader / Inventory):
 * rounded boxes, text presets, tinted line icons, tap zones, buttons, item
 * tiles and the shared header. Coordinates are absolute in the 540×1200 canvas.
 */
import type Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../theme/uiPalette";
import { DAMAGE_NUMBER_FONT_FAMILY } from "../../config/damageNumbers";
import { uiIconFrame, type UiIconName } from "../icons/uiIcons";
import {
  rerenderTextsWhenFontReady,
  uiTextStyle,
  UI_FONT_FAMILY,
} from "../layout/uiTextStyle";
import {
  DG_BUTTON_STROKE,
  DG_ICON_TINT,
  DG_THEME,
  DG_TITLE_FONT,
  hexToInt,
} from "../theme/dgTheme";
import type { TileView } from "./gearPanelView";
import type { ActionStyle } from "./shopPanelView";

export type BoxStyle = {
  fill: string;
  fillAlpha?: number;
  stroke?: string | null;
  strokeWidth?: number;
  radius?: number;
};

export type Box = {
  g: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  paint(style: BoxStyle): void;
  move(x: number, y: number, w?: number, h?: number): void;
};

export type TextOpts = {
  size: number;
  color?: string;
  title?: boolean;
  bold?: boolean;
  originX?: number;
  originY?: number;
  wrap?: number;
  lineSpacing?: number;
};

export type Tap = {
  zone: Phaser.GameObjects.Rectangle;
  /** Screen-space centre for e2e tap targets. */
  center(): { x: number; y: number };
  setEnabled(on: boolean): void;
  move(x: number, y: number, w: number, h: number): void;
};

export type Button = {
  box: Box;
  label: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Image | null;
  tap: Tap;
  enabled: boolean;
  visible: boolean;
  set(opts: {
    label?: string;
    style?: ActionStyle;
    icon?: UiIconName | null;
    enabled?: boolean;
    visible?: boolean;
    x?: number;
    w?: number;
  }): void;
};

export type Tile = {
  box: Box;
  ring: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image | null;
  badgeBox: Box;
  badge: Phaser.GameObjects.Text;
  tap: Tap | null;
  show(
    view: TileView | null,
    opts?: { selected?: boolean; emptyIcon?: UiIconName | null; dim?: boolean },
  ): void;
  setVisible(on: boolean): void;
};

const BUTTON_FILL: Record<ActionStyle, string> = {
  buy: DG_THEME.buttonBuy,
  equip: DG_THEME.buttonEquip,
  sell: DG_THEME.buttonSell,
  neutral: DG_THEME.buttonNeutral,
};

export class DgKit {
  /** Pixelify title texts, re-rendered once the web font loads. */
  private readonly titleTexts: Phaser.GameObjects.Text[] = [];

  constructor(
    readonly scene: Phaser.Scene,
    readonly root: Phaser.GameObjects.Container,
  ) {}

  box(x: number, y: number, w: number, h: number, style: BoxStyle): Box {
    const g = this.scene.add.graphics({ x: 0, y: 0 });
    this.root.add(g);
    let last = style;
    const box: Box = {
      g,
      x,
      y,
      w,
      h,
      paint: (s) => {
        last = s;
        g.clear();
        const r = s.radius ?? 10;
        g.fillStyle(hexToInt(s.fill), s.fillAlpha ?? 1);
        g.fillRoundedRect(box.x, box.y, box.w, box.h, r);
        if (s.stroke) {
          const sw = s.strokeWidth ?? 1;
          g.lineStyle(sw, hexToInt(s.stroke), 1);
          g.strokeRoundedRect(
            box.x + sw / 2,
            box.y + sw / 2,
            box.w - sw,
            box.h - sw,
            Math.max(0, r - sw / 2),
          );
        }
      },
      move: (nx, ny, nw, nh) => {
        box.x = nx;
        box.y = ny;
        if (nw !== undefined) box.w = nw;
        if (nh !== undefined) box.h = nh;
        box.paint(last);
      },
    };
    box.paint(style);
    return box;
  }

  text(
    x: number,
    y: number,
    str: string,
    o: TextOpts,
  ): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: o.title ? DG_TITLE_FONT : UI_FONT_FAMILY,
      fontSize: `${o.size}px`,
      color: o.color ?? DG_THEME.textPrimary,
      fontStyle: o.bold || o.title ? "bold" : "normal",
    };
    if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
    if (o.lineSpacing !== undefined) style.lineSpacing = o.lineSpacing;
    const t = this.scene.add
      .text(x, y, str, uiTextStyle(this.scene, style))
      .setOrigin(o.originX ?? 0, o.originY ?? 0);
    this.root.add(t);
    if (o.title) this.titleTexts.push(t);
    return t;
  }

  /**
   * Redraw title texts when Pixelify Sans finishes loading (first open on a cold
   * cache), then run `onReady` so the panel can re-fit widths.
   */
  whenTitleFontReady(onReady: () => void): void {
    rerenderTextsWhenFontReady(
      `700 16px "${DAMAGE_NUMBER_FONT_FAMILY}"`,
      () => this.titleTexts,
      onReady,
    );
  }

  /** Centred tinted icon, or null before the icon strip has loaded. */
  icon(
    x: number,
    y: number,
    name: UiIconName,
    px: number,
    tint: string = DG_ICON_TINT,
  ): Phaser.GameObjects.Image | null {
    const f = uiIconFrame(this.scene, name, px);
    if (!f) return null;
    const img = this.scene.add
      .image(x, y, f.key, f.frame)
      .setDisplaySize(px, px)
      .setTint(hexToInt(tint));
    this.root.add(img);
    return img;
  }

  setIcon(
    img: Phaser.GameObjects.Image | null,
    name: UiIconName,
    px: number,
  ): void {
    if (!img) return;
    const f = uiIconFrame(this.scene, name, px);
    if (f) img.setTexture(f.key, f.frame).setDisplaySize(px, px);
  }

  /** Invisible hit rectangle (top-left x/y) calling `onTap` on pointerup. */
  tap(x: number, y: number, w: number, h: number, onTap: () => void): Tap {
    const zone = this.scene.add
      .rectangle(x + w / 2, y + h / 2, w, h, PALETTE.black, 0.001)
      .setInteractive();
    zone.on("pointerup", () => {
      if (zone.input?.enabled !== false) onTap();
    });
    this.root.add(zone);
    return {
      zone,
      center: () => ({ x: zone.x, y: zone.y }),
      setEnabled: (on) => {
        if (on) zone.setInteractive();
        else zone.disableInteractive();
      },
      move: (nx, ny, nw, nh) => {
        zone.setPosition(nx + nw / 2, ny + nh / 2);
        zone.setSize(nw, nh);
        if (zone.input?.hitArea) {
          const hit = zone.input.hitArea as Phaser.Geom.Rectangle;
          hit.width = nw;
          hit.height = nh;
        }
      },
    };
  }

  /** Filled action / header button with an optional leading icon. */
  button(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    style: ActionStyle,
    icon: UiIconName | null,
    onTap: () => void,
    opts: { size?: number; radius?: number } = {},
  ): Button {
    const radius = opts.radius ?? 12;
    const paintBox = (s: ActionStyle) => ({
      fill: BUTTON_FILL[s],
      stroke: DG_BUTTON_STROKE[s],
      strokeWidth: 1.5,
      radius,
    });
    const box = this.box(x, y, w, h, paintBox(style));
    const iconImg = this.icon(x + w / 2, y + h / 2, icon ?? "coins", 20);
    const text = this.text(x + w / 2, y + h / 2, label, {
      size: opts.size ?? 16,
      title: true,
      originX: 0.5,
      originY: 0.5,
    });
    let curIcon = icon;
    const btn: Button = {
      box,
      label: text,
      icon: iconImg,
      tap: this.tap(x, y, w, h, () => {
        if (btn.enabled && btn.visible) onTap();
      }),
      enabled: true,
      visible: true,
      set: (o) => {
        if (o.style) box.paint(paintBox(o.style));
        if (o.x !== undefined || o.w !== undefined) {
          box.move(o.x ?? box.x, box.y, o.w ?? box.w, box.h);
          btn.tap.move(box.x, box.y, box.w, box.h);
        }
        if (o.label !== undefined) text.setText(o.label);
        if (o.icon !== undefined) curIcon = o.icon;
        if (curIcon) this.setIcon(iconImg, curIcon, 20);
        if (o.enabled !== undefined) btn.enabled = o.enabled;
        if (o.visible !== undefined) btn.visible = o.visible;
        // Icon sits left of the label; together they are centred.
        const lw = text.width || 0;
        const iw = curIcon && iconImg ? 28 : 0;
        const cx = box.x + box.w / 2;
        text.setPosition(cx + iw / 2, box.y + box.h / 2);
        iconImg?.setPosition(cx - lw / 2 - iw / 2 + 4, box.y + box.h / 2);
        const alpha = btn.enabled ? 1 : 0.4;
        for (const go of [box.g, text, iconImg]) {
          go?.setVisible(btn.visible).setAlpha(alpha);
        }
        iconImg?.setVisible(btn.visible && !!curIcon);
        btn.tap.setEnabled(btn.visible && btn.enabled);
      },
    };
    btn.set({});
    return btn;
  }

  /** Item tile: rarity border, centred icon, item-level badge, white double ring when selected. */
  tile(x: number, y: number, size: number, onTap: (() => void) | null): Tile {
    const ring = this.scene.add.graphics({ x: 0, y: 0 });
    this.root.add(ring);
    const box = this.box(x, y, size, size, {
      fill: DG_THEME.bgSlot,
      stroke: DG_THEME.borderIron,
      strokeWidth: 2,
      radius: 8,
    });
    const iconPx = Math.round(size * 0.56);
    const icon = this.icon(x + size / 2, y + size / 2, "sparkles", iconPx);
    const bw = Math.round(size * 0.42);
    const bh = Math.round(size * 0.26);
    const badgeBox = this.box(x + size - bw - 4, y + size - bh - 4, bw, bh, {
      fill: PALETTE_CSS.black,
      fillAlpha: 0.7,
      radius: 4,
    });
    const badge = this.text(x + size - 4 - bw / 2, y + size - 4 - bh / 2, "", {
      size: Math.max(10, Math.round(size * 0.19)),
      bold: true,
      originX: 0.5,
      originY: 0.5,
    });
    const tap = onTap ? this.tap(x, y, size, size, onTap) : null;
    let visible = true;
    let hasBadge = false;
    const tile: Tile = {
      box,
      ring,
      icon,
      badgeBox,
      badge,
      tap,
      show: (view, opts = {}) => {
        const empty = view === null;
        box.paint({
          fill: DG_THEME.bgSlot,
          stroke: empty ? DG_THEME.borderIron : view.color,
          strokeWidth: 2,
          radius: 8,
        });
        const iconName = view?.icon ?? opts.emptyIcon ?? "sparkles";
        this.setIcon(icon, iconName, iconPx);
        icon?.setAlpha(empty ? 0.16 : opts.dim ? 0.3 : 1);
        hasBadge = !!view?.badge;
        badge.setText(view?.badge ?? "");
        badgeBox.g.setVisible(visible && hasBadge);
        badge.setVisible(visible && hasBadge);
        ring.clear();
        if (opts.selected) {
          ring.lineStyle(2, PALETTE.white, 1);
          ring.strokeRoundedRect(x - 3, y - 3, size + 6, size + 6, 10);
          ring.lineStyle(1, PALETTE.white, 0.7);
          ring.strokeRoundedRect(x - 7, y - 7, size + 14, size + 14, 12);
        }
      },
      setVisible: (on) => {
        visible = on;
        box.g.setVisible(on);
        ring.setVisible(on);
        icon?.setVisible(on);
        badgeBox.g.setVisible(on && hasBadge);
        badge.setVisible(on && hasBadge);
        tap?.setEnabled(on);
      },
    };
    tile.show(null);
    return tile;
  }

  /** Crimson disc + gold ring + line icon (mockup header emblem). */
  private drawEmblem(cx: number, cy: number, icon: UiIconName): void {
    const g = this.scene.add.graphics({ x: 0, y: 0 });
    g.fillStyle(hexToInt(DG_THEME.accentCrimson), 1);
    g.fillCircle(cx, cy, 26);
    g.lineStyle(2, hexToInt(DG_THEME.accentGold), 1);
    g.strokeCircle(cx, cy, 25);
    this.root.add(g);
    this.icon(cx, cy, icon, 26, DG_ICON_TINT);
  }

  /** Header card: crimson emblem, Pixelify title, subtitle, gold pill, close (×). */
  header(
    title: string,
    onClose: () => void,
    emblem: UiIconName,
  ): {
    title: Phaser.GameObjects.Text;
    subtitle: Phaser.GameObjects.Text;
    gold: Phaser.GameObjects.Text;
    close: Tap;
  } {
    this.box(16, 20, 508, 80, {
      fill: DG_THEME.bgPanel,
      stroke: DG_THEME.accentGold,
      strokeWidth: 1.5,
      radius: 14,
    });
    this.drawEmblem(58, 60, emblem);
    const titleText = this.text(96, 28, title, { size: 32, title: true });
    const subtitle = this.text(97, 72, "", {
      size: 13,
      color: DG_THEME.textMuted,
    });
    this.box(370, 44, 92, 32, {
      fill: DG_THEME.bgSlot,
      stroke: DG_THEME.accentGold,
      strokeWidth: 1,
      radius: 16,
    });
    this.icon(390, 60, "coins", 18, DG_THEME.accentGold);
    const gold = this.text(404, 60, "", {
      size: 16,
      title: true,
      color: DG_THEME.accentGoldBright,
      originY: 0.5,
    });
    this.box(472, 40, 40, 40, {
      fill: DG_THEME.buttonNeutral,
      stroke: DG_THEME.borderSteel,
      strokeWidth: 1,
      radius: 10,
    });
    this.icon(492, 60, "close", 20);
    // Generous hit area for the close button (touch).
    const close = this.tap(466, 30, 56, 60, onClose);
    return { title: titleText, subtitle, gold, close };
  }

  /** Two-tab segmented control (y 112–162). */
  tabs(defs: { label: string; icon: UiIconName; onTap: () => void }[]): {
    set(active: number, counts: string[]): void;
    taps: Tap[];
  } {
    this.box(16, 112, 508, 50, {
      fill: DG_THEME.bgSlot,
      stroke: DG_THEME.borderIron,
      strokeWidth: 1,
      radius: 12,
    });
    const w = (508 - 8 - 4 * (defs.length - 1)) / defs.length;
    const parts = defs.map((d, i) => {
      const x = 20 + i * (w + 4);
      const box = this.box(x, 116, w, 42, { fill: DG_THEME.bgSlot, radius: 9 });
      const icon = this.icon(x + w / 2 - 40, 137, d.icon, 18);
      const label = this.text(x + w / 2 - 26, 137, d.label, {
        size: 16,
        title: true,
        originY: 0.5,
      });
      const count = this.text(x + w / 2, 138, "", {
        size: 12,
        color: DG_THEME.textSecondary,
        originY: 0.5,
      });
      const tap = this.tap(x, 116, w, 42, d.onTap);
      return { x, box, icon, label, count, tap };
    });
    return {
      taps: parts.map((p) => p.tap),
      set: (active, counts) => {
        parts.forEach((p, i) => {
          const on = i === active;
          p.box.paint(
            on
              ? {
                  fill: DG_THEME.bgSelected,
                  stroke: DG_THEME.accentGold,
                  strokeWidth: 1.5,
                  radius: 9,
                }
              : { fill: DG_THEME.bgSlot, radius: 9 },
          );
          p.label.setColor(
            on ? DG_THEME.accentGoldBright : DG_THEME.textSecondary,
          );
          p.icon?.setAlpha(on ? 1 : 0.55);
          p.count.setText(counts[i] ?? "");
          // Centre icon + label + count as one group.
          const lw = p.label.width || 0;
          const cw = p.count.width || 0;
          const total = 26 + lw + (cw ? 8 + cw : 0);
          const left = p.x + w / 2 - total / 2;
          p.icon?.setPosition(left + 9, 137);
          p.label.setPosition(left + 26, 137);
          p.count.setPosition(left + 26 + lw + 8, 138);
        });
      },
    };
  }

  /** "‹ ›" page buttons centred on `xPrev` / `xNext` at `y` (hidden for one page). */
  pager(
    xPrev: number,
    xNext: number,
    y: number,
    onPage: (delta: number) => void,
  ): { prev: Tap; next: Tap; set(page: number, pages: number): void } {
    const part = (x: number, glyph: string, delta: number) => {
      const box = this.box(x - 15, y - 12, 30, 24, {
        fill: DG_THEME.buttonNeutral,
        stroke: DG_THEME.borderSteel,
        radius: 6,
      });
      const t = this.text(x, y - 1, glyph, {
        size: 18,
        bold: true,
        color: DG_THEME.accentGold,
        originX: 0.5,
        originY: 0.5,
      });
      const tap = this.tap(x - 20, y - 18, 40, 36, () => onPage(delta));
      return { box, t, tap };
    };
    const prev = part(xPrev, "‹", -1);
    const next = part(xNext, "›", 1);
    return {
      prev: prev.tap,
      next: next.tap,
      set: (page, pages) => {
        const paged = pages > 1;
        for (const [p, on] of [
          [prev, page > 0],
          [next, page < pages - 1],
        ] as const) {
          p.box.g.setVisible(paged).setAlpha(on ? 1 : 0.35);
          p.t.setVisible(paged).setAlpha(on ? 1 : 0.35);
          p.tap.setEnabled(paged && on);
        }
      },
    };
  }

  /** Small uppercase gold section label + optional muted right text. */
  section(y: number): {
    left: Phaser.GameObjects.Text;
    right: Phaser.GameObjects.Text;
  } {
    return {
      left: this.text(16, y, "", {
        size: 12,
        bold: true,
        color: DG_THEME.accentGold,
        originY: 0.5,
      }).setLetterSpacing(1.5),
      right: this.text(524, y, "", {
        size: 12,
        color: DG_THEME.textSecondary,
        originX: 1,
        originY: 0.5,
      }),
    };
  }
}

/** Trim `str` with "…" until the text fits `maxW` (no-op when width is unknown). */
export function fitText(
  t: Phaser.GameObjects.Text,
  str: string,
  maxW: number,
): void {
  t.setText(str);
  let s = str;
  while (s.length > 1 && (t.width || 0) > maxW) {
    s = s.slice(0, -1);
    t.setText(`${s.trimEnd()}…`);
  }
}
