import { equipDiff, type StatDiff } from "../../gear/gearText";
import {
  bagItems,
  equipItem,
  equippedSlotOf,
  findItem,
  nextSortMode,
  removeItem,
  sortItems,
  unequipSlot,
  type ItemSortMode,
} from "../../gear/inventory";
import {
  resolveItem,
  sellValue,
  type ResolvedItem,
} from "../../gear/itemStats";
import type { LootConfig } from "../../gear/loot";
import type { EquipSlot, GearCatalog } from "../../gear/gearTypes";
import type { SaveGame } from "../../core/saveTypes";

export const GEAR_PANEL_ROWS_PER_PAGE = 6;

export type GearPanelState = {
  sort: ItemSortMode;
  page: number;
  /** Selected owned item (bag or equipped). */
  selectedUid: number | null;
  status: string;
};

export type GearPanelCommand =
  | { type: "select"; uid: number | null }
  | { type: "selectSlot"; slot: EquipSlot }
  | { type: "page"; delta: number }
  | { type: "sort" }
  | { type: "equip" }
  | { type: "unequip" }
  | { type: "sell" };

export type GearPanelContext = {
  catalog: GearCatalog;
  loot: LootConfig;
};

export function createGearPanelState(): GearPanelState {
  return { sort: "slot", page: 0, selectedUid: null, status: "" };
}

/** Bag items (unequipped) in the current sort order. */
export function bagRows(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): ResolvedItem[] {
  return sortItems(ctx.catalog, bagItems(save.gear), state.sort);
}

export function pageCount(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount / GEAR_PANEL_ROWS_PER_PAGE));
}

export function visibleRows<T>(rows: readonly T[], page: number): T[] {
  const start = page * GEAR_PANEL_ROWS_PER_PAGE;
  return rows.slice(start, start + GEAR_PANEL_ROWS_PER_PAGE);
}

export function selectedItem(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): ResolvedItem | null {
  if (state.selectedUid === null) return null;
  const item = findItem(save.gear, state.selectedUid);
  return item ? resolveItem(ctx.catalog, item) : null;
}

export type GearPanelActions = {
  canEquip: boolean;
  canUnequip: boolean;
  canSell: boolean;
  sellPrice: number;
};

export function gearPanelActions(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): GearPanelActions {
  const sel = selectedItem(ctx, save, state);
  if (!sel) {
    return { canEquip: false, canUnequip: false, canSell: false, sellPrice: 0 };
  }
  const equipped = equippedSlotOf(save.gear, sel.item.uid) !== undefined;
  return {
    canEquip: !equipped,
    canUnequip: equipped,
    canSell: true,
    sellPrice: sellValue(sel.price, ctx.loot.sellBackPct),
  };
}

/** Compare lines for the selected bag item vs what it would replace. */
export function selectedDiff(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): StatDiff[] {
  const sel = selectedItem(ctx, save, state);
  if (!sel || equippedSlotOf(save.gear, sel.item.uid)) return [];
  return equipDiff(ctx.catalog, save.gear, sel.item.uid);
}

function clampPage(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): GearPanelState {
  const pages = pageCount(bagRows(ctx, save, state).length);
  return { ...state, page: Math.min(Math.max(0, state.page), pages - 1) };
}

/** Apply a panel command; returns the next save (unchanged unless gear / gold changed). */
export function reduceGearPanel(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
  cmd: GearPanelCommand,
): { save: SaveGame; state: GearPanelState } {
  const sel = selectedItem(ctx, save, state);
  switch (cmd.type) {
    case "select":
      return { save, state: { ...state, selectedUid: cmd.uid, status: "" } };
    case "selectSlot":
      return {
        save,
        state: {
          ...state,
          selectedUid: save.gear.equipped[cmd.slot] ?? null,
          status: "",
        },
      };
    case "page":
      return {
        save,
        state: clampPage(ctx, save, { ...state, page: state.page + cmd.delta }),
      };
    case "sort":
      return {
        save,
        state: { ...state, sort: nextSortMode(state.sort), page: 0 },
      };
    case "equip": {
      if (!sel || equippedSlotOf(save.gear, sel.item.uid))
        return { save, state };
      const gear = equipItem(ctx.catalog, save.gear, sel.item.uid);
      const next = { ...save, gear };
      return {
        save: next,
        state: clampPage(ctx, next, {
          ...state,
          status: `Equipped ${sel.name}`,
        }),
      };
    }
    case "unequip": {
      const slot = sel ? equippedSlotOf(save.gear, sel.item.uid) : undefined;
      if (!sel || !slot) return { save, state };
      if (bagItems(save.gear).length >= ctx.loot.inventoryCapacity) {
        return {
          save,
          state: { ...state, status: "Bag is full — sell something first" },
        };
      }
      const next = { ...save, gear: unequipSlot(save.gear, slot) };
      return {
        save: next,
        state: { ...state, status: `Unequipped ${sel.name}` },
      };
    }
    case "sell": {
      if (!sel) return { save, state };
      const gold = sellValue(sel.price, ctx.loot.sellBackPct);
      const next = {
        ...save,
        gold: save.gold + gold,
        gear: removeItem(save.gear, sel.item.uid),
      };
      return {
        save: next,
        state: clampPage(ctx, next, {
          ...state,
          selectedUid: null,
          status: `Sold ${sel.name} for ${gold}g`,
        }),
      };
    }
  }
}
