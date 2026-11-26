import type Phaser from "phaser";
import type { SaveGame } from "../core/saveTypes";
import { SLOT_LABELS } from "../gear/gearText";
import { EQUIP_SLOTS, type EquipSlot } from "../gear/gearTypes";
import type { ModalInputLease } from "../input/modalBackdrop";
import { DG_THEME } from "./theme/dgTheme";
import type { DgKit, Tap, Tile } from "./gearPanel/dgPanelKit";
import {
  createActionBar,
  createDetailBox,
  createOverlayRoot,
  type ActionBar,
  type DetailBox,
} from "./gearPanel/gearPanelChrome";
import {
  BAG_TILES_PER_PAGE,
  carriedConsumables,
  createGearPanelState,
  reduceGearPanel,
  type GearPanelCommand,
  type GearPanelContext,
  type GearPanelState,
} from "./gearPanel/gearPanelLogic";
import { inventoryView } from "./gearPanel/inventoryPanelView";
import type { ActionView } from "./gearPanel/shopPanelView";

const SLOT_TILE = 54;
/** Slot tile top-left positions around the hero portrait (540×1200 canvas). */
const SLOT_POS: Record<EquipSlot, { x: number; y: number }> = {
  helm: { x: 30, y: 190 },
  chest: { x: 30, y: 262 },
  hands: { x: 30, y: 334 },
  legs: { x: 30, y: 406 },
  meleeWeapon: { x: 456, y: 190 },
  rangedWeapon: { x: 456, y: 262 },
  boots: { x: 456, y: 334 },
  ring1: { x: 138, y: 478 },
  ring2: { x: 206, y: 478 },
  trinket1: { x: 280, y: 478 },
  trinket2: { x: 348, y: 478 },
};
const BAG_TILE = 64;
const BAG_PITCH = 74;
const BAG_TOP = 610;
const STAT_ROWS = 8;

/**
 * Inventory overlay (town Gear button): 11 equipment slots around the hero
 * portrait, total stats, a 7×3 paged bag grid, item detail + compare,
 * Equip / Sell and Gear / Consumables tabs.
 */
export class InventoryPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly kit: DgKit;
  private readonly lease: ModalInputLease;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly closeTap: Tap;
  private readonly tabs: ReturnType<DgKit["tabs"]>;
  private readonly slots: { slot: EquipSlot; tile: Tile }[] = [];
  private readonly heroCaption: Phaser.GameObjects.Text;
  private readonly statRows: {
    label: Phaser.GameObjects.Text;
    value: Phaser.GameObjects.Text;
  }[] = [];
  private readonly bagLabel: ReturnType<DgKit["section"]>;
  private readonly sortText: Phaser.GameObjects.Text;
  private readonly sortTap: Tap;
  private readonly pager: ReturnType<DgKit["pager"]>;
  private readonly tiles: { tile: Tile; key: number | null }[] = [];
  private readonly detail: DetailBox;
  private readonly actionBar: ActionBar;
  private readonly footnote: Phaser.GameObjects.Text;
  private state: GearPanelState = createGearPanelState("bag");
  private tornDown = false;

  constructor(
    scene: Phaser.Scene,
    private readonly getSave: () => SaveGame,
    private readonly onSaveChange: (save: SaveGame) => void,
    private readonly onDismiss: (() => void) | undefined,
    private readonly ctx: GearPanelContext,
  ) {
    const o = createOverlayRoot(scene);
    this.root = o.root;
    this.kit = o.kit;
    this.lease = o.lease;
    const kit = this.kit;

    const head = kit.header("Inventory", () => this.destroy());
    this.subtitle = head.subtitle;
    this.goldText = head.gold;
    this.closeTap = head.close;
    this.tabs = kit.tabs([
      {
        label: "Gear",
        icon: "sword",
        onTap: () => this.dispatch({ type: "view", view: "gear" }),
      },
      {
        label: "Consumables",
        icon: "potion",
        onTap: () => this.dispatch({ type: "view", view: "consumables" }),
      },
    ]);

    // Equipment card.
    kit.box(16, 176, 508, 384, {
      fill: DG_THEME.bgPanel,
      stroke: DG_THEME.borderIron,
      radius: 14,
    });
    kit.box(98, 190, 344, 100, {
      fill: DG_THEME.bgSelected,
      stroke: DG_THEME.accentGold,
      radius: 10,
    });
    kit.icon(270, 230, "user", 40, DG_THEME.textSecondary);
    this.heroCaption = kit.text(270, 272, "", {
      size: 12,
      bold: true,
      color: DG_THEME.accentGoldBright,
      originX: 0.5,
      originY: 0.5,
    });
    for (let i = 0; i < STAT_ROWS; i++) {
      const y = 308 + i * 20;
      this.statRows.push({
        label: kit.text(104, y, "", {
          size: 14,
          color: DG_THEME.textSecondary,
          originY: 0.5,
        }),
        value: kit.text(436, y, "", {
          size: 14,
          bold: true,
          originX: 1,
          originY: 0.5,
        }),
      });
    }
    kit.box(98, 466, 344, 1, { fill: DG_THEME.borderIron, radius: 0 });
    kit.box(269, 482, 1, 46, { fill: DG_THEME.borderIron, radius: 0 });
    for (const slot of EQUIP_SLOTS) {
      const p = SLOT_POS[slot];
      const tile = kit.tile(p.x, p.y, SLOT_TILE, () =>
        this.dispatch({ type: "selectSlot", slot }),
      );
      this.slots.push({ slot, tile });
      kit
        .text(p.x + SLOT_TILE / 2, p.y + SLOT_TILE + 9, "", {
          size: 10,
          bold: true,
          color: DG_THEME.textMuted,
          originX: 0.5,
          originY: 0.5,
        })
        .setLetterSpacing(1)
        .setText(SLOT_LABELS[slot].toUpperCase());
    }

    // Bag.
    this.bagLabel = kit.section(586);
    kit.box(428, 572, 96, 28, {
      fill: DG_THEME.buttonNeutral,
      stroke: DG_THEME.borderSteel,
      radius: 8,
    });
    kit.icon(446, 586, "sort", 16);
    this.sortText = kit.text(458, 586, "", { size: 13, originY: 0.5 });
    this.sortTap = kit.tap(424, 566, 104, 40, () =>
      this.dispatch({ type: "sort" }),
    );
    this.pager = kit.pager(316, 404, 586, (delta) =>
      this.dispatch({ type: "page", delta }),
    );
    for (let i = 0; i < BAG_TILES_PER_PAGE; i++) {
      const x = 16 + (i % 7) * BAG_PITCH;
      const y = BAG_TOP + Math.floor(i / 7) * BAG_PITCH;
      const cell: { tile: Tile; key: number | null } = {
        key: null,
        tile: kit.tile(x, y, BAG_TILE, () => this.onTile(cell.key)),
      };
      this.tiles.push(cell);
    }

    this.detail = createDetailBox(kit, 836, 1108);
    this.actionBar = createActionBar(kit, 1120, 48, (id) => this.onAction(id));
    this.footnote = kit.text(270, 1184, "", {
      size: 12,
      color: DG_THEME.textMuted,
      originX: 0.5,
      originY: 0.5,
    });
    this.refresh();
  }

  private onTile(key: number | null): void {
    if (key === null) return;
    if (this.state.view === "consumables") {
      const e = carriedConsumables(this.ctx, this.getSave())[key];
      if (e?.kind === "consumable") {
        this.dispatch({ type: "selectConsumable", id: e.def.id });
      }
      return;
    }
    this.dispatch({ type: "select", uid: key });
  }

  private onAction(id: ActionView["id"]): void {
    if (id === "equip" || id === "unequip" || id === "sell") {
      this.dispatch({ type: id });
    }
  }

  private dispatch(cmd: GearPanelCommand): void {
    const prev = this.getSave();
    const { save, state } = reduceGearPanel(
      this.ctx,
      prev,
      this.state,
      cmd,
      BAG_TILES_PER_PAGE,
    );
    this.state = state;
    if (save !== prev) this.onSaveChange(save);
    this.refresh();
  }

  private refresh(): void {
    const v = inventoryView(this.ctx, this.getSave(), this.state);
    this.subtitle.setText(v.subtitle);
    this.goldText.setText(v.gold);
    this.tabs.set(this.state.view === "gear" ? 0 : 1, [
      v.gearCount,
      v.consumableCount,
    ]);
    v.slots.forEach((s, i) => {
      this.slots[i]!.tile.show(s.tile, {
        selected: s.selected,
        emptyIcon: s.emptyIcon,
      });
    });
    this.heroCaption.setText(v.heroCaption);
    this.statRows.forEach((row, i) => {
      const s = v.stats[i];
      row.label.setText(s?.label ?? "");
      row.value.setText(s?.value ?? "");
    });
    this.bagLabel.left.setText(v.bagLabel.toUpperCase());
    const paged = v.pages > 1;
    this.bagLabel.right
      .setText(paged ? `${v.page + 1}/${v.pages}` : "")
      .setPosition(360, 586)
      .setOrigin(0.5, 0.5);
    this.pager.set(v.page, v.pages);
    this.sortText.setText(v.sortLabel);
    v.tiles.forEach((t, i) => {
      const cell = this.tiles[i]!;
      cell.key = t.key;
      cell.tile.show(t.tile, { selected: t.selected });
    });
    this.detail.show(
      v.detail,
      this.state.view === "gear"
        ? "Tap a slot or a bag item to see its stats."
        : "Tap a potion or bomb to see what it does.",
    );
    this.actionBar.show(v.actions);
    this.footnote.setText(v.footnote.text).setColor(v.footnote.color);
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
    const add = (id: string, t: Tap | null) => {
      if (t && t.zone.input?.enabled !== false) out[id] = t.center();
    };
    add("inv-close", this.closeTap);
    add("inv-tab-gear", this.tabs.taps[0]!);
    add("inv-tab-consumables", this.tabs.taps[1]!);
    add("inv-sort", this.sortTap);
    add("inv-prev", this.pager.prev);
    add("inv-next", this.pager.next);
    for (const s of this.slots) add(`inv-slot-${s.slot}`, s.tile.tap);
    this.tiles.forEach((cell, i) => {
      if (cell.key !== null) add(`inv-bag-${i}`, cell.tile.tap);
    });
    this.actionBar.buttons.forEach((b, i) => {
      const id = this.actionBar.ids[i];
      if (id && b.visible && b.enabled) add(`inv-${id}`, b.tap);
    });
    return out;
  }
}
