/**
 * Shared pieces of the Blacksmith / Trader and Inventory overlays: the dim
 * modal root, card widgets, the detail + compare box and the action bar.
 */
import type Phaser from "phaser";
import { GAME } from "../../config";
import { INPUT_MODALITY } from "../../input/inputModality";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../../input/modalBackdrop";
import { DG_ICON_TINT, DG_THEME, hexToInt } from "../theme/dgTheme";
import {
  DgKit,
  fitText,
  type Box,
  type Button,
  type Tap,
  type Tile,
} from "./dgPanelKit";
import type { ActionView, DetailView, ShopCardView } from "./shopPanelView";

export type OverlayRoot = {
  root: Phaser.GameObjects.Container;
  kit: DgKit;
  lease: ModalInputLease;
};

/** Full-screen container (depth 500) over a dark backdrop, holding the modal lease. */
export function createOverlayRoot(scene: Phaser.Scene): OverlayRoot {
  const root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);
  const dim = scene.add.rectangle(
    GAME.width / 2,
    GAME.height / 2,
    GAME.width,
    GAME.height,
    0x0c0a09,
    1,
  );
  bindModalDimBackdrop(dim);
  root.add(dim);
  const lease = acquireModalInput(scene, INPUT_MODALITY.townGear);
  return { root, kit: new DgKit(scene, root), lease };
}

export type Card = {
  box: Box;
  tile: Tile;
  name: Phaser.GameObjects.Text;
  price: Phaser.GameObjects.Text;
  coin: Phaser.GameObjects.Image | null;
  meta: Phaser.GameObjects.Text;
  stat: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image | null;
  tap: Tap | null;
  key: number | null;
  show(view: ShopCardView | null): void;
};

export const CARD_W = 246;
export const CARD_H = 70;

export function createCard(
  kit: DgKit,
  x: number,
  y: number,
  onTap: ((card: Card) => void) | null,
): Card {
  const box = kit.box(x, y, CARD_W, CARD_H, {
    fill: DG_THEME.bgRaised,
    stroke: DG_THEME.borderIron,
    radius: 10,
  });
  const tile = kit.tile(x + 8, y + 8, 54, null);
  const lock = kit.icon(x + 35, y + 35, "lock", 30, DG_THEME.textMuted);
  const name = kit.text(x + 72, y + 9, "", { size: 15, bold: true });
  const price = kit.text(x + CARD_W - 10, y + 30, "", {
    size: 16,
    title: true,
    color: DG_THEME.accentGoldBright,
    originX: 1,
  });
  const coin = kit.icon(
    x + CARD_W - 60,
    y + 19,
    "coins",
    14,
    DG_THEME.accentGold,
  );
  const meta = kit.text(x + 72, y + 31, "", {
    size: 12,
    color: DG_THEME.textSecondary,
  });
  const stat = kit.text(x + 72, y + 48, "", {
    size: 12,
    color: DG_THEME.textSecondary,
  });
  const card: Card = {
    box,
    tile,
    name,
    price,
    coin,
    meta,
    stat,
    lock,
    tap: null,
    key: null,
    show: (v) => {
      const on = v !== null;
      card.key = v?.key ?? null;
      for (const go of [box.g, name, price, coin, meta, stat])
        go?.setVisible(on);
      tile.setVisible(on);
      lock?.setVisible(on && !!v?.locked);
      card.tap?.setEnabled(on && !v?.locked);
      if (!v) return;
      box.paint(
        v.selected
          ? {
              fill: DG_THEME.bgSelected,
              stroke: DG_THEME.accentGoldBright,
              strokeWidth: 2,
              radius: 10,
            }
          : {
              fill: v.locked ? DG_THEME.bgSlot : DG_THEME.bgRaised,
              stroke: DG_THEME.borderIron,
              radius: 10,
            },
      );
      tile.show(v.tile, { dim: v.locked });
      tile.icon?.setVisible(!v.locked);
      price.setText(v.price).setColor(v.priceColor);
      const pw = price.width || 0;
      coin
        ?.setPosition(x + CARD_W - 10 - pw - 10, y + 19)
        .setAlpha(v.locked ? 0.5 : 1);
      name.setColor(v.nameColor);
      fitText(name, v.name, CARD_W - 72 - pw - 30);
      meta.setColor(v.metaColor);
      fitText(meta, v.meta, CARD_W - 82);
      fitText(stat, v.stat, CARD_W - 82);
    },
  };
  if (onTap) card.tap = kit.tap(x, y, CARD_W, CARD_H, () => onTap(card));
  card.show(null);
  return card;
}

const DETAIL_LINES = 6;
const DETAIL_ROWS = 8;
const DETAIL_PILLS = 6;

export type DetailBox = {
  show(d: DetailView | null, hint: string): void;
};

/**
 * Detail + compare box (`top`..`bottom`): tile, name, subline, stat lines,
 * then "COMPARED WITH EQUIPPED" rows; flows top-down and drops what doesn't fit.
 */
export function createDetailBox(
  kit: DgKit,
  top: number,
  bottom: number,
): DetailBox {
  const panel = kit.box(16, top, 508, bottom - top, {
    fill: DG_THEME.bgPanel,
    stroke: DG_THEME.accentGold,
    strokeWidth: 1.5,
    radius: 14,
  });
  const tile = kit.tile(32, top + 16, 60, null);
  const name = kit.text(106, top + 15, "", { size: 24, title: true });
  const subline = kit.text(106, top + 46, "", {
    size: 12,
    color: DG_THEME.textSecondary,
  });
  const lines = Array.from({ length: DETAIL_LINES }, () => ({
    icon: kit.icon(42, 0, "star", 16),
    text: kit.text(58, 0, "", { size: 14, originY: 0.5 }),
    tag: kit.text(508, 0, "", {
      size: 12,
      color: DG_THEME.textSecondary,
      originX: 1,
      originY: 0.5,
    }),
  }));
  const pillSlots = Array.from({ length: DETAIL_PILLS }, () => ({
    bg: kit.box(0, 0, 80, 24, {
      fill: DG_THEME.bgRaised,
      stroke: DG_THEME.borderIron,
      strokeWidth: 1,
      radius: 10,
    }),
    icon: kit.icon(0, 0, "star", 14),
    text: kit.text(0, 0, "", { size: 12, bold: true, originY: 0.5 }),
  }));
  const info = kit.text(32, 0, "", {
    size: 13,
    color: DG_THEME.textSecondary,
    wrap: 476,
    lineSpacing: 4,
  });
  const divider = kit.box(32, 0, 476, 1, {
    fill: DG_THEME.borderIron,
    radius: 0,
  });
  const cmpTitle = kit
    .text(32, 0, "", {
      size: 12,
      bold: true,
      color: DG_THEME.accentGold,
      originY: 0.5,
    })
    .setLetterSpacing(1.5);
  const against = kit.text(508, 0, "", {
    size: 12,
    originX: 1,
    originY: 0.5,
  });
  const rows = Array.from({ length: DETAIL_ROWS }, () => ({
    label: kit.text(32, 0, "", {
      size: 14,
      color: DG_THEME.textSecondary,
      originY: 0.5,
    }),
    from: kit.text(370, 0, "", {
      size: 14,
      color: DG_THEME.textMuted,
      originX: 1,
      originY: 0.5,
    }),
    to: kit.text(438, 0, "", {
      size: 14,
      bold: true,
      originX: 1,
      originY: 0.5,
    }),
    delta: kit.text(508, 0, "", {
      size: 13,
      bold: true,
      originX: 1,
      originY: 0.5,
    }),
  }));
  const hideAll = () => {
    for (const p of pillSlots) {
      p.bg.g.setVisible(false);
      p.icon?.setVisible(false);
      p.text.setVisible(false);
    }
    for (const l of lines) {
      l.icon?.setVisible(false);
      l.text.setVisible(false);
      l.tag.setVisible(false);
    }
    for (const r of rows) {
      for (const t of [r.label, r.from, r.to, r.delta]) t.setVisible(false);
    }
    divider.g.setVisible(false);
    cmpTitle.setVisible(false);
    against.setVisible(false);
    info.setVisible(false);
  };
  return {
    show: (d, hint) => {
      hideAll();
      tile.setVisible(!!d?.tile);
      if (d?.tile) tile.show(d.tile);
      const textX = d?.tile ? 106 : 32;
      name.setPosition(textX, top + 16);
      subline.setPosition(textX, top + 46);
      if (!d) {
        name.setText("");
        fitText(subline, hint, 476);
        return;
      }
      panel.paint({
        fill: DG_THEME.bgPanel,
        stroke: d.borderColor ?? DG_THEME.accentGold,
        strokeWidth: 1.5,
        radius: 14,
      });
      name.setColor(d.nameColor);
      fitText(name, d.name, 508 - textX - 16);
      fitText(subline, d.subline, 508 - textX - 16);
      let y = top + (d.tile ? 68 : 52);
      const limit = bottom - 14;
      const pills = d.pills ?? [];
      if (pills.length) {
        let px = textX;
        let pillRowY = y;
        for (let i = 0; i < Math.min(pills.length, DETAIL_PILLS); i++) {
          const pill = pills[i]!;
          const slot = pillSlots[i]!;
          const labelW = Math.min(132, Math.max(64, pill.text.length * 7 + 36));
          if (px + labelW > 508 && px > textX) {
            px = textX;
            pillRowY += 28;
          }
          if (pillRowY + 14 > limit) break;
          slot.bg.move(px, pillRowY - 12, labelW, 24);
          slot.bg.g.setVisible(true);
          slot.icon?.setPosition(px + 14, pillRowY).setVisible(true);
          kit.setIcon(slot.icon, pill.icon, 14);
          slot.icon?.setTint(hexToInt(DG_ICON_TINT));
          slot.text
            .setPosition(px + 26, pillRowY)
            .setText(pill.text)
            .setColor(DG_THEME.textPrimary)
            .setVisible(true);
          fitText(slot.text, pill.text, labelW - 30);
          px += labelW + 8;
        }
        y = pillRowY + 22;
      } else if (d.tile) {
        y = top + 90;
      } else {
        y = top + 74;
      }
      d.lines.slice(0, DETAIL_LINES).forEach((line, i) => {
        if (y + 10 > limit) return;
        const l = lines[i]!;
        l.icon?.setPosition(32, y).setVisible(true);
        kit.setIcon(l.icon, line.icon, 16);
        l.icon?.setTint(hexToInt(line.color));
        const textMax = line.tag ? 290 : 380;
        l.text
          .setPosition(52, y)
          .setColor(line.color)
          .setFontStyle(line.tag ? "bold" : "normal")
          .setVisible(true);
        fitText(l.text, line.text, textMax);
        l.tag.setPosition(508, y).setText(line.tag).setVisible(!!line.tag);
        y += 22;
      });
      if (d.info.length) {
        info
          .setPosition(32, y - 6)
          .setText(d.info.join("\n"))
          .setVisible(true);
        y += (info.height || d.info.length * 20) + 4;
      }
      if (!d.compareTitle || y + 40 > limit) return;
      y += 4;
      divider.move(32, y, 476, 1);
      divider.g.setVisible(true);
      y += 16;
      cmpTitle
        .setPosition(32, y)
        .setText(d.compareTitle.toUpperCase())
        .setVisible(true);
      against.setPosition(508, y).setColor(d.againstColor).setVisible(true);
      fitText(against, d.against, 260);
      y += 22;
      if (d.rows.length === 0) {
        const r = rows[0]!;
        r.label.setPosition(32, y).setText("No stat change").setVisible(true);
        return;
      }
      // Keep the last row (gold after) when the list is trimmed.
      const fit = Math.max(
        1,
        Math.min(DETAIL_ROWS, Math.floor((limit - y + 12) / 20)),
      );
      const shown =
        d.rows.length > fit
          ? [...d.rows.slice(0, fit - 1), d.rows[d.rows.length - 1]!]
          : d.rows;
      shown.forEach((row, i) => {
        const r = rows[i]!;
        const color = row.better
          ? DG_THEME.statePositive
          : DG_THEME.stateNegative;
        r.label.setPosition(32, y).setText(row.label).setVisible(true);
        r.from.setPosition(372, y).setText(`${row.from} →`).setVisible(true);
        r.to
          .setPosition(440, y)
          .setText(row.to)
          .setColor(color)
          .setVisible(true);
        r.delta
          .setPosition(508, y)
          .setText(row.delta)
          .setColor(color)
          .setVisible(true);
        y += 22;
      });
    },
  };
}

export type ActionBar = {
  buttons: Button[];
  /** Current action id per button (null = hidden). */
  ids: (ActionView["id"] | null)[];
  show(actions: ActionView[]): void;
};

/** Bottom bar with up to two buttons; one action spans the full width. */
export function createActionBar(
  kit: DgKit,
  y: number,
  h: number,
  onAction: (id: ActionView["id"]) => void,
): ActionBar {
  const bar: ActionBar = {
    buttons: [],
    ids: [null, null],
    show: (actions) => {
      bar.buttons.forEach((b, i) => {
        const a = actions[i];
        bar.ids[i] = a?.id ?? null;
        if (!a) {
          b.set({ visible: false });
          return;
        }
        const single = actions.length === 1;
        b.set({
          visible: true,
          label: a.label,
          style: a.style,
          icon: a.icon,
          enabled: a.enabled,
          x: single ? 16 : 16 + i * 258,
          w: single ? 508 : 250,
        });
      });
    },
  };
  for (let i = 0; i < 2; i++) {
    bar.buttons.push(
      kit.button(16 + i * 258, y, 250, h, "", "neutral", null, () => {
        const id = bar.ids[i];
        if (id) onAction(id);
      }),
    );
  }
  return bar;
}
