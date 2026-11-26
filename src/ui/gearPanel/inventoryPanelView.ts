/** Inventory panel view model: slots, totals, bag grid, detail and actions. */
import type { SaveGame } from "../../core/saveTypes";
import { consumableCount } from "../../gear/consumables";
import { SLOT_LABELS } from "../../gear/gearText";
import { EQUIP_SLOTS, type EquipSlot } from "../../gear/gearTypes";
import {
  bagItems,
  equippedSlotOf,
  type ItemSortMode,
} from "../../gear/inventory";
import { resolveItem, sellValue } from "../../gear/itemStats";
import { saveTalentBonus } from "../../talents/talentRuntime";
import { iconForSlot, type UiIconName } from "../icons/uiIcons";
import { DG_THEME } from "../theme/dgTheme";
import {
  BAG_TILES_PER_PAGE,
  carriedConsumables,
  listEntries,
  pageCount,
  selectedItem,
  visibleRows,
  type GearPanelContext,
  type GearPanelState,
} from "./gearPanelLogic";
import {
  CONSUMABLE_COLOR,
  consumableLines,
  consumableSubline,
  consumableTile,
  itemDetailLines,
  itemSubline,
  itemTile,
  ownedItemCompare,
  totalStatRows,
  type StatRow,
  type TileView,
} from "./gearPanelView";
import type { ActionView, DetailView } from "./shopPanelView";

export type SlotView = {
  slot: EquipSlot;
  label: string;
  /** Null when the slot is empty (dim placeholder icon). */
  tile: TileView | null;
  emptyIcon: UiIconName;
  selected: boolean;
};

export type BagTileView = {
  /** Item uid / consumable list index; null for an empty cell. */
  key: number | null;
  tile: TileView | null;
  selected: boolean;
};

export type InventoryView = {
  title: string;
  subtitle: string;
  gold: string;
  gearCount: string;
  consumableCount: string;
  slots: SlotView[];
  heroCaption: string;
  stats: StatRow[];
  bagLabel: string;
  sortLabel: string;
  page: number;
  pages: number;
  tiles: BagTileView[];
  detail: DetailView | null;
  actions: ActionView[];
  footnote: { text: string; color: string };
};

const SORT_LABELS: Record<ItemSortMode, string> = {
  slot: "Slot",
  rarity: "Rarity",
  value: "Value",
  level: "Level",
};

function slotViews(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): SlotView[] {
  return EQUIP_SLOTS.map((slot) => {
    const uid = save.gear.equipped[slot];
    const item = save.gear.items.find((i) => i.uid === uid);
    const r = item ? resolveItem(ctx.catalog, item) : null;
    return {
      slot,
      label: SLOT_LABELS[slot],
      tile: r ? itemTile(r) : null,
      emptyIcon: iconForSlot(slot),
      selected: uid !== undefined && uid === state.selectedUid,
    };
  });
}

function itemDetail(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): DetailView | null {
  const r = selectedItem(ctx, save, state);
  if (!r) return null;
  const cmp = ownedItemCompare(ctx.catalog, save.gear, r.item.uid);
  return {
    tile: itemTile(r),
    name: r.name,
    nameColor: r.rarity.color,
    subline: itemSubline(r),
    lines: itemDetailLines(ctx.catalog, r),
    pills: [],
    borderColor: r.rarity.color,
    compareTitle: cmp.title,
    against: cmp.against,
    againstColor: cmp.againstColor,
    rows: cmp.rows,
    info: r.unique?.note ? [`“${r.unique.note}”`] : [],
  };
}

function consumableDetail(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): DetailView | null {
  const entry = carriedConsumables(ctx, save).find(
    (e) => e.kind === "consumable" && e.def.id === state.selectedConsumable,
  );
  if (entry?.kind !== "consumable") return null;
  return {
    tile: consumableTile(entry.def, entry.count),
    name: entry.def.name,
    nameColor: CONSUMABLE_COLOR,
    subline: consumableSubline(entry.def),
    pills: [],
    lines: consumableLines(save, entry.def),
    compareTitle: "",
    against: "",
    againstColor: DG_THEME.textMuted,
    rows: [],
    info: [],
  };
}

function actions(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): ActionView[] {
  if (state.view === "consumables") return [];
  const r = selectedItem(ctx, save, state);
  const equipped = r
    ? equippedSlotOf(save.gear, r.item.uid) !== undefined
    : false;
  const sell = r ? sellValue(r.price, ctx.loot.sellBackPct) : null;
  return [
    equipped
      ? {
          id: "unequip",
          label: "Unequip",
          icon: "arrowUp",
          style: "neutral",
          enabled: true,
        }
      : {
          id: "equip",
          label: "Equip",
          icon: "arrowUp",
          style: "equip",
          enabled: !!r,
        },
    {
      id: "sell",
      label: sell !== null ? `Sell · ${sell}g` : "Sell",
      icon: "coins",
      style: "sell",
      enabled: !!r,
    },
  ];
}

export function inventoryView(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): InventoryView {
  const bag = bagItems(save.gear).length;
  const carried = carriedConsumables(ctx, save).reduce(
    (n, e) =>
      n + (e.kind === "consumable" ? consumableCount(save, e.def.id) : 0),
    0,
  );
  const entries = listEntries(ctx, save, state);
  const pages = pageCount(entries.length, BAG_TILES_PER_PAGE);
  const page = Math.min(state.page, pages - 1);
  const shown = visibleRows(entries, page, BAG_TILES_PER_PAGE);
  const consumables = state.view === "consumables";
  const tiles: BagTileView[] = Array.from(
    { length: BAG_TILES_PER_PAGE },
    (_, i) => {
      const e = shown[i];
      if (!e) return { key: null, tile: null, selected: false };
      if (e.kind === "consumable") {
        return {
          key: e.key,
          tile: consumableTile(e.def, e.count),
          selected: e.def.id === state.selectedConsumable,
        };
      }
      return {
        key: e.key,
        tile: itemTile(e.item),
        selected: e.key === state.selectedUid,
      };
    },
  );
  const cap = ctx.loot.inventoryCapacity;
  const pct = ctx.loot.sellBackPct;
  return {
    title: "Inventory",
    subtitle: `Night ${save.night} · ${bag}/${cap} items in bag`,
    gold: `${save.gold}g`,
    gearCount: String(bag),
    consumableCount: String(carried),
    slots: slotViews(ctx, save, state),
    heroCaption: `Hero · Night ${save.night}`,
    stats: totalStatRows(ctx.catalog, save.gear, 8, saveTalentBonus(save)),
    bagLabel: consumables ? "Potions & bombs" : `Bag · ${bag}/${cap}`,
    sortLabel: SORT_LABELS[state.sort],
    page,
    pages,
    tiles,
    detail: consumables
      ? consumableDetail(ctx, save, state)
      : itemDetail(ctx, save, state),
    actions: actions(ctx, save, state),
    footnote: state.status
      ? { text: state.status, color: DG_THEME.accentGoldBright }
      : {
          text: consumables
            ? "Buy potions and bombs from the trader or blacksmith; use them in combat."
            : `Tap a slot or bag item. Items sell for ${pct}% of their value.`,
          color: DG_THEME.textMuted,
        },
  };
}
