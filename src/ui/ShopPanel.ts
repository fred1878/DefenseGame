import type Phaser from "phaser";
import type { SaveGame } from "../core/saveTypes";
import type { ModalInputLease } from "../input/modalBackdrop";
import { DG_THEME } from "./theme/dgTheme";
import type { Box, DgKit, Tap } from "./gearPanel/dgPanelKit";
import {
  createActionBar,
  createCard,
  createDetailBox,
  createOverlayRoot,
  type ActionBar,
  type Card,
  type DetailBox,
} from "./gearPanel/gearPanelChrome";
import {
  createGearPanelState,
  pageCount,
  pageSize,
  reduceGearPanel,
  visibleRows,
  type GearFilter,
  type GearPanelCommand,
  type GearPanelContext,
  type GearPanelState,
} from "./gearPanel/gearPanelLogic";
import {
  requestActions,
  requestCards,
  requestDetail,
  traderRequests,
} from "./gearPanel/requestPanelLogic";
import {
  filterChips,
  lockedCards,
  shopActions,
  shopCards,
  shopDetail,
  shopFootnote,
  shopHeader,
  shopSections,
  type ActionView,
} from "./gearPanel/shopPanelView";

const GRID_TOP = 242;
const ROW_PITCH = 78;
const COLS_X = [16, 278] as const;
const DETAIL_TOP = 742;
const DETAIL_BOTTOM = 1086;
const ACTION_Y = 1100;

type Chip = {
  id: GearFilter | null;
  box: ReturnType<DgKit["box"]>;
  label: Phaser.GameObjects.Text;
  tap: Tap;
};

/**
 * Blacksmith / Trader overlay (DG Theme): Buy / Sell tabs, filter chips, a
 * 2-column card grid with "Coming soon" stock, detail + compare and one
 * bottom action bar. Upgrade / reroll show in the bar when nothing is selected.
 */
export class ShopPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly kit: DgKit;
  private readonly lease: ModalInputLease;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly closeTap: Tap;
  private readonly tabs: ReturnType<DgKit["tabs"]>;
  private readonly chips: Chip[] = [];
  private readonly sortTap: Tap;
  private readonly sortBox: Box;
  private readonly sortIcon: Phaser.GameObjects.Image | null;
  private readonly stockLabel: ReturnType<DgKit["section"]>;
  private readonly soonLabel: ReturnType<DgKit["section"]>;
  private readonly pager: ReturnType<DgKit["pager"]>;
  private readonly cards: Card[] = [];
  private readonly locked: Card[] = [];
  private readonly detail: DetailBox;
  private readonly actionBar: ActionBar;
  private readonly footnote: Phaser.GameObjects.Text;
  private state: GearPanelState;
  private perPage = 12;
  private tornDown = false;

  constructor(
    scene: Phaser.Scene,
    private readonly getSave: () => SaveGame,
    private readonly onSaveChange: (save: SaveGame) => void,
    private readonly onDismiss: (() => void) | undefined,
    private readonly ctx: GearPanelContext,
  ) {
    if (!ctx.shop) throw new Error("ShopPanel needs a shop context");
    this.state = createGearPanelState("shop");
    const o = createOverlayRoot(scene);
    this.root = o.root;
    this.kit = o.kit;
    this.lease = o.lease;
    const kit = this.kit;

    const head = kit.header(
      shopHeader(ctx, getSave()).title,
      () => this.destroy(),
      ctx.shop.id === "blacksmith" ? "hammer" : "coins",
    );
    this.subtitle = head.subtitle;
    this.goldText = head.gold;
    this.closeTap = head.close;
    this.tabs = kit.tabs([
      {
        label: "Buy",
        icon: ctx.shop.id === "blacksmith" ? "hammer" : "coins",
        onTap: () => this.dispatch({ type: "tab", tab: "shop" }),
      },
      {
        label: "Sell",
        icon: "coins",
        onTap: () => this.dispatch({ type: "tab", tab: "bag" }),
      },
      // The trader also posts nightly buy requests ("Wants").
      ...(ctx.shop.id === "trader"
        ? [
            {
              label: "Wants",
              icon: "star" as const,
              onTap: () => this.dispatch({ type: "tab", tab: "requests" }),
            },
          ]
        : []),
    ]);

    for (let i = 0; i < 5; i++) {
      const box = kit.box(16, 176, 60, 32, {
        fill: DG_THEME.bgRaised,
        radius: 16,
      });
      const label = kit.text(28, 192, "", { size: 13, originY: 0.5 });
      const chip: Chip = {
        id: null,
        box,
        label,
        tap: kit.tap(16, 172, 60, 40, () => {
          if (chip.id) this.dispatch({ type: "filter", filter: chip.id });
        }),
      };
      this.chips.push(chip);
    }
    this.sortBox = kit.box(476, 176, 48, 32, {
      fill: DG_THEME.buttonNeutral,
      stroke: DG_THEME.borderSteel,
      radius: 10,
    });
    this.sortIcon = kit.icon(500, 192, "sort", 18);
    this.sortTap = kit.tap(470, 170, 60, 44, () =>
      this.dispatch({ type: "sort" }),
    );

    this.stockLabel = kit.section(226);
    this.pager = kit.pager(456, 506, 226, (delta) =>
      this.dispatch({ type: "page", delta }),
    );

    for (let i = 0; i < 12; i++) {
      const x = COLS_X[i % 2]!;
      const y = GRID_TOP + Math.floor(i / 2) * ROW_PITCH;
      this.cards.push(
        createCard(kit, x, y, (card) => {
          if (card.key === null) return;
          this.dispatch(
            this.state.tab === "bag"
              ? { type: "select", uid: card.key }
              : { type: "selectOffer", index: card.key },
          );
        }),
      );
    }
    this.soonLabel = kit.section(GRID_TOP + 5 * ROW_PITCH + 12);
    for (let i = 0; i < 2; i++) {
      this.locked.push(
        createCard(kit, COLS_X[i]!, GRID_TOP + 5 * ROW_PITCH + 28, null),
      );
    }
    this.detail = createDetailBox(kit, DETAIL_TOP, DETAIL_BOTTOM);
    this.actionBar = createActionBar(kit, ACTION_Y, 50, (id) =>
      this.onAction(id),
    );
    this.footnote = kit.text(270, 1172, "", {
      size: 12,
      color: DG_THEME.textSecondary,
      originX: 0.5,
      originY: 0.5,
    });
    this.refresh();
    kit.whenTitleFontReady(() => {
      if (!this.tornDown) this.refresh();
    });
  }

  private onAction(id: ActionView["id"]): void {
    const cmd: Record<ActionView["id"], GearPanelCommand> = {
      buy: { type: "buy" },
      buyEquip: { type: "buyEquip" },
      sell: { type: "sell" },
      equip: { type: "equip" },
      unequip: { type: "unequip" },
      upgrade: { type: "upgradeShop" },
      reroll: { type: "reroll" },
      fill: { type: "fillRequest" },
    };
    this.dispatch(cmd[id]);
  }

  private dispatch(cmd: GearPanelCommand): void {
    const prev = this.getSave();
    const { save, state } = reduceGearPanel(
      this.ctx,
      prev,
      this.state,
      cmd,
      this.perPage,
    );
    this.state = state;
    if (save !== prev) this.onSaveChange(save);
    this.refresh();
  }

  private refresh(): void {
    const save = this.getSave();
    const ctx = this.ctx;
    const st = this.state;
    const head = shopHeader(ctx, save);
    this.subtitle.setText(head.subtitle);
    this.goldText.setText(head.gold);
    const wants = st.tab === "requests";
    this.tabs.set(st.tab === "shop" ? 0 : wants ? 2 : 1, [
      head.buyCount,
      head.sellCount,
      String(traderRequests(ctx, save).length),
    ]);

    // Chips: lay out left to right from their label widths (none on Wants).
    const chips = wants ? [] : filterChips(ctx, save, st);
    this.sortBox.g.setVisible(!wants);
    this.sortIcon?.setVisible(!wants);
    this.sortTap.setEnabled(!wants);
    let cx = 16;
    this.chips.forEach((chip, i) => {
      const v = chips[i];
      chip.id = v?.id ?? null;
      const on = !!v;
      chip.box.g.setVisible(on);
      chip.label.setVisible(on);
      chip.tap.setEnabled(on);
      if (!v) return;
      chip.label.setText(v.label);
      chip.label.setColor(v.active ? DG_THEME.bgAbyss : DG_THEME.textSecondary);
      chip.label.setFontStyle(v.active ? "bold" : "normal");
      const w = (chip.label.width || 0) + 26;
      chip.box.move(cx, 176, w, 32);
      chip.box.paint(
        v.active
          ? { fill: DG_THEME.accentGold, radius: 16 }
          : {
              fill: DG_THEME.bgRaised,
              stroke: DG_THEME.borderIron,
              radius: 16,
            },
      );
      chip.label.setPosition(cx + 13, 192);
      chip.tap.move(cx, 172, w, 40);
      cx += w + 8;
    });

    const locked = wants ? [] : lockedCards(ctx, save, st);
    this.perPage = pageSize(ctx, locked.length > 0);
    const all = wants ? requestCards(ctx, save, st) : shopCards(ctx, save, st);
    const pages = pageCount(all.length, this.perPage);
    const page = Math.min(st.page, pages - 1);
    const shown = visibleRows(all, page, this.perPage);
    this.cards.forEach((card, i) => {
      card.show(i < this.perPage ? (shown[i] ?? null) : null);
    });

    const sec = wants
      ? {
          stock: { left: "Trader wants", right: `${all.length} today` },
          soon: { left: "", right: "" },
        }
      : shopSections(ctx, save, st, all.length);
    const sortNote = st.sort === "slot" ? "" : ` · by ${st.sort}`;
    this.stockLabel.left.setText(sec.stock.left.toUpperCase());
    const paged = pages > 1;
    this.stockLabel.right
      .setText(
        paged
          ? `${sec.stock.right}${sortNote} · ${page + 1}/${pages}`
          : `${sec.stock.right}${sortNote}`,
      )
      .setPosition(paged ? 432 : 524, 226);
    this.pager.set(page, pages);
    if (all.length === 0) {
      this.stockLabel.right.setText(
        st.tab === "bag"
          ? "Bag is empty — win nights to find gear"
          : wants
            ? "No requests left — new ones after the next night"
            : "Sold out — new stock after the next night",
      );
    }

    const showSoon = locked.length > 0;
    this.soonLabel.left.setText(showSoon ? sec.soon.left.toUpperCase() : "");
    this.soonLabel.right.setText(showSoon ? sec.soon.right : "");
    this.locked.forEach((card, i) => {
      card.show(showSoon ? (locked[i] ?? null) : null);
    });

    this.detail.show(
      wants ? requestDetail(ctx, save, st) : shopDetail(ctx, save, st),
      "",
    );
    this.actionBar.show(
      wants ? requestActions(ctx, save, st) : shopActions(ctx, save, st),
    );
    const foot = shopFootnote(ctx, st);
    this.footnote.setText(foot.text).setColor(foot.color);
  }

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.lease.release();
    if (this.root.active) this.root.destroy();
    this.onDismiss?.();
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const on = (t: Tap) => t.zone.input?.enabled !== false && t.zone.visible;
    const add = (id: string, t: Tap) => {
      if (on(t)) out[id] = t.center();
    };
    add("shop-close", this.closeTap);
    add("shop-tab-buy", this.tabs.taps[0]!);
    add("shop-tab-sell", this.tabs.taps[1]!);
    if (this.tabs.taps[2]) add("shop-tab-wants", this.tabs.taps[2]);
    add("shop-sort", this.sortTap);
    add("shop-prev", this.pager.prev);
    add("shop-next", this.pager.next);
    for (const chip of this.chips) {
      if (chip.id) add(`shop-chip-${chip.id}`, chip.tap);
    }
    this.cards.forEach((card, i) => {
      if (card.key !== null && card.tap) add(`shop-card-${i}`, card.tap);
    });
    this.actionBar.buttons.forEach((b, i) => {
      const id = this.actionBar.ids[i];
      if (id && b.visible && b.enabled) add(`shop-${id}`, b.tap);
    });
    return out;
  }
}
