import type Phaser from "phaser";
import { GAME } from "../config";
import { basePlayerTuning } from "../config/player";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { SaveGame } from "../core/saveTypes";
import { getGearCatalog } from "../gear/gearCatalog";
import {
  gearSummaryLines,
  itemDetailLines,
  SLOT_LABELS,
} from "../gear/gearText";
import { bagItems } from "../gear/inventory";
import {
  effectivePlayerTuning,
  gearStatsFor,
  resolveItem,
} from "../gear/itemStats";
import { getLootConfig } from "../gear/loot";
import { EQUIP_SLOTS, type EquipSlot } from "../gear/gearTypes";
import { INPUT_MODALITY } from "../input/inputModality";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../input/modalBackdrop";
import { createTouchButton, interactiveObjectScreenRect } from "./touchButton";
import { uiTextStyle } from "./uiTextStyle";
import {
  bagRows,
  createGearPanelState,
  GEAR_PANEL_ROWS_PER_PAGE,
  gearPanelActions,
  pageCount,
  reduceGearPanel,
  selectedDiff,
  selectedItem,
  visibleRows,
  type GearPanelCommand,
  type GearPanelContext,
  type GearPanelState,
} from "./gearPanel/gearPanelLogic";

type Button = ReturnType<typeof createTouchButton>;

type SlotCell = {
  slot: EquipSlot;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
};

type BagRow = {
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
  uid: number | null;
};

const SELECTED_FILL = 0x1e3a5f;
const SELECTED_STROKE = 0x60a5fa;
const CELL_FILL = 0x27272a;
const CELL_STROKE = 0x52525b;

/**
 * Town overlay: equipped slots (4×3 grid), the bag (paged, sortable), item
 * details with a compare-vs-equipped diff, and equip / unequip / sell.
 */
export class GearPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly modalLease: ModalInputLease;
  private readonly ctx: GearPanelContext;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly summaryText: Phaser.GameObjects.Text;
  private readonly bagTitle: Phaser.GameObjects.Text;
  private readonly pageText: Phaser.GameObjects.Text;
  private readonly detailName: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly diffTitle: Phaser.GameObjects.Text;
  private readonly diffLines: Phaser.GameObjects.Text[] = [];
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly cells: SlotCell[] = [];
  private readonly rows: BagRow[] = [];
  private readonly sortBtn: Button;
  private readonly prevBtn: Button;
  private readonly nextBtn: Button;
  private readonly equipBtn: Button;
  private readonly unequipBtn: Button;
  private readonly sellBtn: Button;
  private readonly closeBtn: Button;
  private state: GearPanelState = createGearPanelState();
  private tornDown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getSave: () => SaveGame,
    private readonly onSaveChange: (save: SaveGame) => void,
    private readonly onDismiss?: () => void,
    ctx?: GearPanelContext,
  ) {
    this.ctx = ctx ?? { catalog: getGearCatalog(), loot: getLootConfig() };
    const root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);
    this.root = root;

    const dim = scene.add.rectangle(
      GAME.width / 2,
      GAME.height / 2,
      GAME.width,
      GAME.height,
      0x09090b,
      0.94,
    );
    bindModalDimBackdrop(dim);
    root.add(dim);
    this.modalLease = acquireModalInput(scene, INPUT_MODALITY.townGear);

    const left = scaleUiX(10);
    const innerW = GAME.width - left * 2;
    const text = (
      x: number,
      y: number,
      size: number,
      color: string,
      extra: Phaser.Types.GameObjects.Text.TextStyle = {},
    ) => {
      const t = scene.add.text(
        x,
        y,
        "",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(size)}px`,
          color,
          ...extra,
        }),
      );
      root.add(t);
      return t;
    };

    // Layout in the 390×844 legacy UI space (scaleUiX / scaleUiY).
    text(left, scaleUiY(12), 22, "#f4f4f5").setText("Gear");
    this.goldText = text(
      GAME.width - left,
      scaleUiY(16),
      16,
      "#fbbf24",
    ).setOrigin(1, 0);
    this.summaryText = text(left, scaleUiY(44), 12, "#d4d4d8", {
      lineSpacing: scaleUiY(2),
      wordWrap: { width: innerW },
    });

    // Equipped slots: 4 columns × 3 rows.
    const cols = 4;
    const gap = scaleUiX(4);
    const cellW = (innerW - gap * (cols - 1)) / cols;
    const cellH = scaleUiY(46);
    const gridTop = scaleUiY(98);
    EQUIP_SLOTS.forEach((slot, i) => {
      const cx = left + (i % cols) * (cellW + gap) + cellW / 2;
      const cy = gridTop + Math.floor(i / cols) * (cellH + gap) + cellH / 2;
      const bg = scene.add
        .rectangle(cx, cy, cellW, cellH, CELL_FILL, 1)
        .setStrokeStyle(2, CELL_STROKE)
        .setInteractive();
      bg.on("pointerup", () => this.dispatch({ type: "selectSlot", slot }));
      root.add(bg);
      text(
        cx - cellW / 2 + scaleUiX(4),
        cy - cellH / 2 + scaleUiY(2),
        10,
        "#a1a1aa",
      ).setText(SLOT_LABELS[slot]);
      const name = text(cx, cy + scaleUiY(7), 11, "#fafafa", {
        align: "center",
        wordWrap: { width: cellW - scaleUiX(6) },
      }).setOrigin(0.5);
      this.cells.push({ slot, bg, name });
    });

    // Bag list.
    const bagTop = gridTop + 3 * cellH + 2 * gap + scaleUiY(8);
    this.bagTitle = text(left, bagTop + scaleUiY(4), 15, "#f4f4f5");
    this.sortBtn = this.button(
      GAME.width - left - scaleUiX(60),
      bagTop + scaleUiY(12),
      "Sort",
      120,
      26,
      0x3f3f46,
      0xa1a1aa,
      () => this.dispatch({ type: "sort" }),
    );
    const rowH = scaleUiY(40);
    const rowGap = scaleUiY(4);
    const listTop = bagTop + scaleUiY(30);
    for (let i = 0; i < GEAR_PANEL_ROWS_PER_PAGE; i++) {
      const cy = listTop + i * (rowH + rowGap) + rowH / 2;
      const bg = scene.add
        .rectangle(GAME.width / 2, cy, innerW, rowH, CELL_FILL, 1)
        .setStrokeStyle(2, CELL_STROKE)
        .setInteractive();
      root.add(bg);
      const name = text(
        left + scaleUiX(8),
        cy - scaleUiY(8),
        14,
        "#fafafa",
      ).setOrigin(0, 0.5);
      const meta = text(
        left + scaleUiX(8),
        cy + scaleUiY(10),
        11,
        "#a1a1aa",
      ).setOrigin(0, 0.5);
      const row: BagRow = { bg, name, meta, uid: null };
      bg.on("pointerup", () => {
        if (row.uid !== null) this.dispatch({ type: "select", uid: row.uid });
      });
      this.rows.push(row);
    }
    const pagerY =
      listTop + GEAR_PANEL_ROWS_PER_PAGE * (rowH + rowGap) + scaleUiY(12);
    this.prevBtn = this.button(
      GAME.width / 2 - scaleUiX(100),
      pagerY,
      "◀ Prev",
      90,
      26,
      0x3f3f46,
      0xa1a1aa,
      () => this.dispatch({ type: "page", delta: -1 }),
    );
    this.nextBtn = this.button(
      GAME.width / 2 + scaleUiX(100),
      pagerY,
      "Next ▶",
      90,
      26,
      0x3f3f46,
      0xa1a1aa,
      () => this.dispatch({ type: "page", delta: 1 }),
    );
    this.pageText = text(GAME.width / 2, pagerY, 13, "#a1a1aa").setOrigin(0.5);

    // Detail + compare box.
    const detailTop = pagerY + scaleUiY(20);
    const detailH = scaleUiY(172);
    root.add(
      scene.add
        .rectangle(
          GAME.width / 2,
          detailTop + detailH / 2,
          innerW,
          detailH,
          0x18181b,
          1,
        )
        .setStrokeStyle(2, 0x3f3f46),
    );
    const colW = innerW / 2 - scaleUiX(10);
    this.detailName = text(
      left + scaleUiX(8),
      detailTop + scaleUiY(6),
      14,
      "#fafafa",
      {
        wordWrap: { width: innerW - scaleUiX(16) },
      },
    );
    this.detailText = text(
      left + scaleUiX(8),
      detailTop + scaleUiY(28),
      11,
      "#d4d4d8",
      {
        lineSpacing: scaleUiY(1),
        wordWrap: { width: colW },
      },
    );
    const diffX = GAME.width / 2 + scaleUiX(4);
    this.diffTitle = text(diffX, detailTop + scaleUiY(28), 11, "#a1a1aa");
    for (let i = 0; i < 9; i++) {
      this.diffLines.push(
        text(diffX, detailTop + scaleUiY(44 + i * 14), 11, "#4ade80", {
          wordWrap: { width: colW },
        }),
      );
    }

    // Actions.
    const actionY = detailTop + detailH + scaleUiY(26);
    const third = innerW / 3;
    this.equipBtn = this.button(
      left + third / 2,
      actionY,
      "Equip",
      112,
      36,
      0x15803d,
      0x4ade80,
      () => this.dispatch({ type: "equip" }),
    );
    this.unequipBtn = this.button(
      left + third / 2,
      actionY,
      "Unequip",
      112,
      36,
      0x1d4ed8,
      0x60a5fa,
      () => this.dispatch({ type: "unequip" }),
    );
    this.sellBtn = this.button(
      left + third * 1.5,
      actionY,
      "Sell",
      112,
      36,
      0x9f1239,
      0xfb7185,
      () => this.dispatch({ type: "sell" }),
    );
    this.closeBtn = this.button(
      left + third * 2.5,
      actionY,
      "Close",
      112,
      36,
      0x52525b,
      0xa1a1aa,
      () => this.destroy(),
    );
    this.statusText = text(
      GAME.width / 2,
      actionY + scaleUiY(24),
      12,
      "#fbbf24",
      {
        align: "center",
      },
    ).setOrigin(0.5, 0);

    this.refresh();
  }

  private button(
    x: number,
    y: number,
    label: string,
    w: number,
    h: number,
    fill: number,
    stroke: number,
    onTap: () => void,
  ): Button {
    const btn = createTouchButton(this.scene, x, y, label, onTap, {
      width: scaleUiX(w),
      height: scaleUiY(h),
      depth: 510,
      fontSize: `${scaleUiX(13)}px`,
      fillColor: fill,
      strokeColor: stroke,
      tapPadding: scaleUiX(4),
    });
    this.root.add(btn.container);
    return btn;
  }

  private dispatch(cmd: GearPanelCommand): void {
    const prev = this.getSave();
    const { save, state } = reduceGearPanel(this.ctx, prev, this.state, cmd);
    this.state = state;
    if (save !== prev) this.onSaveChange(save);
    this.refresh();
  }

  private refresh(): void {
    const { catalog, loot } = this.ctx;
    const save = this.getSave();
    const stats = gearStatsFor(catalog, save.gear);
    const tuning = effectivePlayerTuning(basePlayerTuning(), stats);
    this.goldText.setText(`${save.gold}g`);
    this.summaryText.setText(
      gearSummaryLines(catalog, stats, tuning).join("\n"),
    );

    for (const cell of this.cells) {
      const uid = save.gear.equipped[cell.slot];
      const item = save.gear.items.find((i) => i.uid === uid);
      const r = item ? resolveItem(catalog, item) : null;
      cell.name.setText(r ? r.name : "—");
      cell.name.setColor(r ? r.rarity.color : "#52525b");
      const on = uid !== undefined && uid === this.state.selectedUid;
      cell.bg.setFillStyle(on ? SELECTED_FILL : CELL_FILL);
      cell.bg.setStrokeStyle(2, on ? SELECTED_STROKE : CELL_STROKE);
    }

    const all = bagRows(this.ctx, save, this.state);
    const pages = pageCount(all.length);
    this.bagTitle.setText(
      `Bag ${bagItems(save.gear).length}/${loot.inventoryCapacity}`,
    );
    this.sortBtn.setLabel(`Sort: ${this.state.sort}`);
    this.pageText.setText(`${this.state.page + 1}/${pages}`);
    this.setEnabled(this.prevBtn, this.state.page > 0);
    this.setEnabled(this.nextBtn, this.state.page < pages - 1);
    const shown = visibleRows(all, this.state.page);
    this.rows.forEach((row, i) => {
      const r = shown[i];
      row.uid = r?.item.uid ?? null;
      row.bg.setVisible(r !== undefined);
      row.name.setText(r ? r.name : "");
      row.name.setColor(r ? r.rarity.color : "#fafafa");
      row.meta.setText(
        r
          ? `${r.rarity.label} · ilvl ${r.item.itemLevel} · ${SLOT_LABELS[catalogSlot(r.base.type)]} · ${r.price}g`
          : "",
      );
      const on = r !== undefined && r.item.uid === this.state.selectedUid;
      row.bg.setFillStyle(on ? SELECTED_FILL : CELL_FILL);
      row.bg.setStrokeStyle(2, on ? SELECTED_STROKE : CELL_STROKE);
    });
    if (all.length === 0) {
      this.rows[0]?.name.setText("Bag is empty — win nights to find gear");
      this.rows[0]?.name.setColor("#71717a");
    }

    const sel = selectedItem(this.ctx, save, this.state);
    this.detailName.setText(sel ? sel.name : "Tap an item or slot");
    this.detailName.setColor(sel ? sel.rarity.color : "#71717a");
    this.detailText.setText(sel ? itemDetailLines(sel).join("\n") : "");
    const diffs = selectedDiff(this.ctx, save, this.state);
    const actions = gearPanelActions(this.ctx, save, this.state);
    this.diffTitle.setText(
      sel ? (actions.canUnequip ? "Equipped" : "If equipped:") : "",
    );
    this.diffLines.forEach((line, i) => {
      const d = diffs[i];
      line.setText(d ? d.text : "");
      line.setColor(d?.better ? "#4ade80" : "#f87171");
    });
    if (sel && actions.canEquip && diffs.length === 0) {
      this.diffLines[0]?.setText("No stat change");
      this.diffLines[0]?.setColor("#a1a1aa");
    }

    this.setVisible(this.equipBtn, !actions.canUnequip);
    this.setVisible(this.unequipBtn, actions.canUnequip);
    this.setEnabled(this.equipBtn, actions.canEquip);
    this.setEnabled(this.sellBtn, actions.canSell);
    this.sellBtn.setLabel(
      actions.canSell ? `Sell ${actions.sellPrice}g` : "Sell",
    );
    this.statusText.setText(this.state.status);
  }

  private setVisible(btn: Button, visible: boolean): void {
    btn.container.setVisible(visible);
    if (visible) btn.container.setInteractive();
    else btn.container.disableInteractive();
  }

  private setEnabled(btn: Button, enabled: boolean): void {
    if (!btn.container.visible) return;
    btn.container.setAlpha(enabled ? 1 : 0.45);
    if (enabled) btn.container.setInteractive();
    else btn.container.disableInteractive();
  }

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.modalLease.release();
    if (this.root.active) this.root.destroy();
    this.onDismiss?.();
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const add = (id: string, btn: Button): void => {
      if (!btn.container.visible || btn.container.alpha < 1) return;
      const r = interactiveObjectScreenRect(btn.container);
      if (!r) return;
      out[id] = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    add("gear-sort", this.sortBtn);
    add("gear-prev", this.prevBtn);
    add("gear-next", this.nextBtn);
    add("gear-equip", this.equipBtn);
    add("gear-unequip", this.unequipBtn);
    add("gear-sell", this.sellBtn);
    add("gear-close", this.closeBtn);
    for (const cell of this.cells) {
      out[`gear-slot-${cell.slot}`] = { x: cell.bg.x, y: cell.bg.y };
    }
    this.rows.forEach((row, i) => {
      if (row.uid !== null) out[`gear-row-${i}`] = { x: row.bg.x, y: row.bg.y };
    });
    return out;
  }
}

function catalogSlot(type: string): EquipSlot {
  if (type === "ring") return "ring1";
  if (type === "trinket") return "trinket1";
  return type as EquipSlot;
}
