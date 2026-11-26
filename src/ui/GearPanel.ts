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
  type StatDiff,
} from "../gear/gearText";
import { bagItems } from "../gear/inventory";
import {
  effectivePlayerTuning,
  gearStatsFor,
  resolveItem,
} from "../gear/itemStats";
import { getLootConfig } from "../gear/loot";
import { EQUIP_SLOTS, type EquipSlot } from "../gear/gearTypes";
import { nextBlacksmithUnlock, shopLevel, shopTitle } from "../gear/shops";
import { INPUT_MODALITY } from "../input/inputModality";
import { saveTalentBonus } from "../talents/talentRuntime";
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
import {
  consumablesSummary,
  offerDetail,
  shopRows,
  shopUpgradeInfo,
  type PanelRow,
} from "./gearPanel/shopPanelLogic";

type Button = ReturnType<typeof createTouchButton>;

type SlotCell = {
  slot: EquipSlot;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
};

type ListRow = {
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
  /** Bag: item uid. Shop: offer index. */
  key: number | null;
};

type Detail = {
  name: string;
  color: string;
  lines: string[];
  diffTitle: string;
  diffs: StatDiff[];
  emptyDiffNote: string;
};

const SELECTED_FILL = 0x1e3a5f;
const SELECTED_STROKE = 0x60a5fa;
const CELL_FILL = 0x27272a;
const CELL_STROKE = 0x52525b;
const TAB_ON = 0x713f12;
const TAB_OFF = 0x3f3f46;

/**
 * Town overlay for gear and shops: equipped slots (4×3 grid), a paged list
 * (bag items or shop offers), item details with a compare-vs-equipped diff,
 * and equip / unequip / sell / buy.
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
  private readonly rows: ListRow[] = [];
  private readonly shopTab: Button | null = null;
  private readonly bagTab: Button | null = null;
  private readonly sortBtn: Button;
  private readonly prevBtn: Button;
  private readonly nextBtn: Button;
  private readonly equipBtn: Button;
  private readonly unequipBtn: Button;
  private readonly buyBtn: Button;
  private readonly sellBtn: Button;
  private readonly upgradeBtn: Button;
  private readonly rerollBtn: Button;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly closeBtn: Button;
  private state: GearPanelState;
  private detailWrap = { item: 0, idle: 0 };
  private tornDown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getSave: () => SaveGame,
    private readonly onSaveChange: (save: SaveGame) => void,
    private readonly onDismiss?: () => void,
    ctx?: GearPanelContext,
  ) {
    this.ctx = ctx ?? { catalog: getGearCatalog(), loot: getLootConfig() };
    this.state = createGearPanelState(this.ctx.shop ? "shop" : "bag");
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
    const title = this.ctx.shop
      ? shopTitle(this.ctx.shop.ctx, this.ctx.shop.id)
      : "Gear";
    this.titleText = text(left, scaleUiY(12), 22, "#f4f4f5").setText(title);
    this.goldText = text(
      GAME.width - left,
      scaleUiY(16),
      16,
      "#fbbf24",
    ).setOrigin(1, 0);
    this.summaryText = text(left, scaleUiY(42), 12, "#d4d4d8", {
      lineSpacing: scaleUiY(1),
      wordWrap: { width: innerW },
    });

    // Equipped slots: 4 columns × 3 rows.
    const cols = 4;
    const gap = scaleUiX(4);
    const cellW = (innerW - gap * (cols - 1)) / cols;
    const cellH = scaleUiY(44);
    const gridTop = scaleUiY(104);
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

    // List header: tabs (shops) or the bag title, plus Sort.
    const listHeadY = gridTop + 3 * cellH + 2 * gap + scaleUiY(20);
    this.bagTitle = text(left, listHeadY - scaleUiY(9), 15, "#f4f4f5");
    if (this.ctx.shop) {
      this.shopTab = this.button(
        left + scaleUiX(48),
        listHeadY,
        "Shop",
        96,
        26,
        TAB_ON,
        0xfbbf24,
        () => this.dispatch({ type: "tab", tab: "shop" }),
      );
      this.bagTab = this.button(
        left + scaleUiX(150),
        listHeadY,
        "Bag",
        96,
        26,
        TAB_OFF,
        0xa1a1aa,
        () => this.dispatch({ type: "tab", tab: "bag" }),
      );
    }
    this.sortBtn = this.button(
      GAME.width - left - scaleUiX(60),
      listHeadY,
      "Sort",
      120,
      26,
      0x3f3f46,
      0xa1a1aa,
      () => this.dispatch({ type: "sort" }),
    );
    this.rerollBtn = this.button(
      GAME.width - left - scaleUiX(60),
      listHeadY,
      "Reroll",
      120,
      26,
      0x3f3f46,
      0xfbbf24,
      () => this.dispatch({ type: "reroll" }),
    );
    const rowH = scaleUiY(40);
    const rowGap = scaleUiY(4);
    const listTop = listHeadY + scaleUiY(18);
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
      const row: ListRow = { bg, name, meta, key: null };
      bg.on("pointerup", () => {
        if (row.key === null) return;
        this.dispatch(
          this.state.tab === "shop"
            ? { type: "selectOffer", index: row.key }
            : { type: "select", uid: row.key },
        );
      });
      this.rows.push(row);
    }
    const pagerY =
      listTop + GEAR_PANEL_ROWS_PER_PAGE * (rowH + rowGap) + scaleUiY(10);
    this.prevBtn = this.button(
      GAME.width / 2 - scaleUiX(100),
      pagerY,
      "◀ Prev",
      90,
      24,
      0x3f3f46,
      0xa1a1aa,
      () => this.dispatch({ type: "page", delta: -1 }),
    );
    this.nextBtn = this.button(
      GAME.width / 2 + scaleUiX(100),
      pagerY,
      "Next ▶",
      90,
      24,
      0x3f3f46,
      0xa1a1aa,
      () => this.dispatch({ type: "page", delta: 1 }),
    );
    this.pageText = text(GAME.width / 2, pagerY, 13, "#a1a1aa").setOrigin(0.5);

    // Detail + compare box.
    const detailTop = pagerY + scaleUiY(18);
    const detailH = scaleUiY(166);
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
    this.detailWrap = { item: colW, idle: innerW - scaleUiX(16) };
    this.detailName = text(
      left + scaleUiX(8),
      detailTop + scaleUiY(6),
      14,
      "#fafafa",
      { wordWrap: { width: innerW - scaleUiX(16) } },
    );
    this.detailText = text(
      left + scaleUiX(8),
      detailTop + scaleUiY(28),
      11,
      "#d4d4d8",
      { lineSpacing: scaleUiY(1), wordWrap: { width: colW } },
    );
    const diffX = GAME.width / 2 + scaleUiX(4);
    this.diffTitle = text(diffX, detailTop + scaleUiY(28), 11, "#a1a1aa");
    for (let i = 0; i < 9; i++) {
      this.diffLines.push(
        text(diffX, detailTop + scaleUiY(44 + i * 13.5), 11, "#4ade80", {
          wordWrap: { width: colW },
        }),
      );
    }

    // Actions.
    const actionY = detailTop + detailH + scaleUiY(24);
    const third = innerW / 3;
    const first = left + third / 2;
    this.equipBtn = this.button(
      first,
      actionY,
      "Equip",
      112,
      36,
      0x15803d,
      0x4ade80,
      () => this.dispatch({ type: "equip" }),
    );
    this.unequipBtn = this.button(
      first,
      actionY,
      "Unequip",
      112,
      36,
      0x1d4ed8,
      0x60a5fa,
      () => this.dispatch({ type: "unequip" }),
    );
    this.buyBtn = this.button(
      first,
      actionY,
      "Buy",
      112,
      36,
      0xa16207,
      0xfde047,
      () => this.dispatch({ type: "buy" }),
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
    this.upgradeBtn = this.button(
      left + third * 1.5,
      actionY,
      "Upgrade",
      112,
      36,
      0x6d28d9,
      0xc4b5fd,
      () => this.dispatch({ type: "upgradeShop" }),
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
      actionY + scaleUiY(22),
      12,
      "#fbbf24",
      { align: "center" },
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

  private listRows(save: SaveGame): PanelRow[] {
    if (this.state.tab === "shop") return shopRows(this.ctx, save);
    return bagRows(this.ctx, save, this.state).map((r) => ({
      key: r.item.uid,
      name: r.name,
      color: r.rarity.color,
      meta: `${r.rarity.label} · ilvl ${r.item.itemLevel} · ${SLOT_LABELS[catalogSlot(r.base.type)]} · ${r.price}g`,
    }));
  }

  private emptyListHint(): string {
    if (this.state.tab === "bag")
      return "Bag is empty — win nights to find gear";
    return "Sold out — new stock after the next night";
  }

  private idleHint(save: SaveGame): string {
    const shop = this.ctx.shop;
    if (!shop || this.state.tab !== "shop") return "";
    const info = shopUpgradeInfo(this.ctx, save);
    const lines: string[] = [];
    if (shop.id === "trader") lines.push("Stock changes after every night.");
    else {
      const next = nextBlacksmithUnlock(
        shop.ctx,
        save.night,
        shopLevel(save, shop.ctx, "blacksmith"),
      );
      lines.push(
        next === null
          ? "Full catalogue unlocked."
          : `More stock unlocks at night ${next}.`,
      );
    }
    if (info) {
      lines.push(`Now: ${info.current}`);
      if (info.next) {
        lines.push(`Next (${info.nextCost ?? "?"}g): ${info.next}`);
      }
    }
    return lines.join("\n");
  }

  private detail(save: SaveGame): Detail | null {
    if (this.state.tab === "shop") {
      const d = offerDetail(this.ctx, save, this.state.selectedOffer);
      if (!d) return null;
      return {
        name: d.name,
        color: d.color,
        lines: d.lines,
        diffTitle: d.diffTitle,
        diffs: d.diffs,
        emptyDiffNote: d.diffTitle ? "No stat change" : "",
      };
    }
    const sel = selectedItem(this.ctx, save, this.state);
    if (!sel) return null;
    const actions = gearPanelActions(this.ctx, save, this.state);
    return {
      name: sel.name,
      color: sel.rarity.color,
      lines: itemDetailLines(sel),
      diffTitle: actions.canUnequip ? "Equipped" : "If equipped:",
      diffs: selectedDiff(this.ctx, save, this.state),
      emptyDiffNote: actions.canEquip ? "No stat change" : "",
    };
  }

  private refresh(): void {
    const { catalog, loot } = this.ctx;
    const save = this.getSave();
    const stats = gearStatsFor(catalog, save.gear, saveTalentBonus(save));
    const tuning = effectivePlayerTuning(basePlayerTuning(), stats);
    this.goldText.setText(`${save.gold}g`);
    const upgrade = shopUpgradeInfo(this.ctx, save);
    if (this.ctx.shop && upgrade) {
      this.titleText.setText(
        `${shopTitle(this.ctx.shop.ctx, this.ctx.shop.id)} · L${upgrade.level}/${upgrade.maxLevel}`,
      );
    }
    const summary = gearSummaryLines(catalog, stats, tuning);
    const carry = consumablesSummary(this.ctx, save);
    this.summaryText.setText(
      [...summary.slice(0, carry ? 2 : 3), carry].filter(Boolean).join("\n"),
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

    const inShop = this.state.tab === "shop";
    const bagLabel = `Bag ${bagItems(save.gear).length}/${loot.inventoryCapacity}`;
    if (this.shopTab && this.bagTab) {
      this.bagTitle.setText("");
      this.bagTab.setLabel(bagLabel);
      this.shopTab.container.setAlpha(inShop ? 1 : 0.6);
      this.bagTab.container.setAlpha(inShop ? 0.6 : 1);
    } else {
      this.bagTitle.setText(bagLabel);
    }
    this.setVisible(this.sortBtn, !inShop);
    this.sortBtn.setLabel(`Sort: ${this.state.sort}`);

    const all = this.listRows(save);
    const pages = pageCount(all.length);
    this.pageText.setText(`${this.state.page + 1}/${pages}`);
    this.setEnabled(this.prevBtn, this.state.page > 0);
    this.setEnabled(this.nextBtn, this.state.page < pages - 1);
    const selectedKey = inShop
      ? this.state.selectedOffer
      : this.state.selectedUid;
    const shown = visibleRows(all, this.state.page);
    this.rows.forEach((row, i) => {
      const r = shown[i];
      row.key = r?.key ?? null;
      row.bg.setVisible(r !== undefined);
      row.name.setText(r ? r.name : "");
      row.name.setColor(r ? r.color : "#fafafa");
      row.meta.setText(r ? r.meta : "");
      const on = r !== undefined && r.key === selectedKey;
      row.bg.setFillStyle(on ? SELECTED_FILL : CELL_FILL);
      row.bg.setStrokeStyle(2, on ? SELECTED_STROKE : CELL_STROKE);
    });
    if (all.length === 0) {
      this.rows[0]?.name.setText(this.emptyListHint());
      this.rows[0]?.name.setColor("#71717a");
    }

    const d = this.detail(save);
    this.detailName.setText(d ? d.name : "Tap an item or slot");
    this.detailName.setColor(d ? d.color : "#71717a");
    this.detailText.setWordWrapWidth(
      d ? this.detailWrap.item : this.detailWrap.idle,
    );
    this.detailText.setText(d ? d.lines.join("\n") : this.idleHint(save));
    this.diffTitle.setText(d ? d.diffTitle : "");
    this.diffLines.forEach((line, i) => {
      const diff = d?.diffs[i];
      line.setText(diff ? diff.text : "");
      line.setColor(diff?.better ? "#4ade80" : "#f87171");
    });
    if (d && d.diffs.length === 0 && d.emptyDiffNote) {
      this.diffLines[0]?.setText(d.emptyDiffNote);
      this.diffLines[0]?.setColor("#a1a1aa");
    }

    const actions = gearPanelActions(this.ctx, save, this.state);
    const offer = inShop
      ? offerDetail(this.ctx, save, this.state.selectedOffer)
      : null;
    this.setVisible(this.buyBtn, inShop);
    this.setVisible(this.equipBtn, !inShop && !actions.canUnequip);
    this.setVisible(this.unequipBtn, !inShop && actions.canUnequip);
    this.setVisible(this.sellBtn, !inShop);
    this.setVisible(this.upgradeBtn, inShop && !!upgrade);
    const nextCost = upgrade?.nextCost ?? null;
    this.setEnabled(this.upgradeBtn, nextCost !== null);
    this.upgradeBtn.setLabel(
      nextCost !== null ? `Upgrade ${nextCost}g` : "Max level",
    );
    const reroll = upgrade?.rerollCost ?? 0;
    this.setVisible(this.rerollBtn, inShop && reroll > 0);
    this.rerollBtn.setLabel(`Reroll ${reroll}g`);
    this.setEnabled(this.equipBtn, actions.canEquip);
    this.setEnabled(this.sellBtn, actions.canSell);
    this.sellBtn.setLabel(
      actions.canSell ? `Sell ${actions.sellPrice}g` : "Sell",
    );
    const canBuy = !!offer && !offer.soldOut && offer.price !== null;
    this.setEnabled(this.buyBtn, canBuy);
    this.buyBtn.setLabel(canBuy ? `Buy ${offer.price}g` : "Buy");
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
    const add = (id: string, btn: Button | null): void => {
      if (!btn?.container.visible || btn.container.alpha < 0.5) return;
      const r = interactiveObjectScreenRect(btn.container);
      if (!r) return;
      out[id] = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    add("gear-tab-shop", this.shopTab);
    add("gear-tab-bag", this.bagTab);
    add("gear-sort", this.sortBtn);
    add("gear-prev", this.prevBtn);
    add("gear-next", this.nextBtn);
    add("gear-equip", this.equipBtn);
    add("gear-unequip", this.unequipBtn);
    add("gear-buy", this.buyBtn);
    add("gear-sell", this.sellBtn);
    add("gear-upgrade", this.upgradeBtn);
    add("gear-reroll", this.rerollBtn);
    add("gear-close", this.closeBtn);
    for (const cell of this.cells) {
      out[`gear-slot-${cell.slot}`] = { x: cell.bg.x, y: cell.bg.y };
    }
    this.rows.forEach((row, i) => {
      if (row.key !== null) {
        out[`gear-row-${i}`] = { x: row.bg.x, y: row.bg.y };
      }
    });
    return out;
  }
}

function catalogSlot(type: string): EquipSlot {
  if (type === "ring") return "ring1";
  if (type === "trinket") return "trinket1";
  return type as EquipSlot;
}
