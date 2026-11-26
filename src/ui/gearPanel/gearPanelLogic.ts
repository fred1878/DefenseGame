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
import type { BuildingDef } from "../../core/DataStore";
import type { Rng } from "../../gear/rng";
import {
  buyOffer,
  ensureShopStock,
  fillTraderRequest,
  rerollTrader,
  shopOffers,
  type ShopContext,
  type ShopId,
} from "../../gear/shops";
import { upgradeShop } from "../../systems/townBuildingMenu";

export const GEAR_PANEL_ROWS_PER_PAGE = 6;

/** `requests` is the trader's buy-request list (trader panel only). */
export type GearPanelTab = "bag" | "shop" | "requests";

export type GearPanelState = {
  tab: GearPanelTab;
  /** Selected shop offer index (shop tab) or request index (requests tab). */
  selectedOffer: number | null;
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
  | { type: "sell" }
  | { type: "tab"; tab: GearPanelTab }
  | { type: "selectOffer"; index: number }
  | { type: "buy" }
  | { type: "upgradeShop" }
  | { type: "reroll" }
  | { type: "fillRequest" };

export type GearPanelContext = {
  catalog: GearCatalog;
  loot: LootConfig;
  /**
   * When set the panel is a shop (Shop + Bag tabs). `buildings` holds the
   * shop upgrade costs (buildings.json); `rng` rolls restocks and rerolls.
   */
  shop?: {
    id: ShopId;
    ctx: ShopContext;
    buildings?: Readonly<Record<string, BuildingDef>>;
    rng?: Rng;
  };
};

export function createGearPanelState(
  tab: GearPanelTab = "bag",
): GearPanelState {
  return {
    tab,
    selectedOffer: null,
    sort: "slot",
    page: 0,
    selectedUid: null,
    status: "",
  };
}

/** Rows in the active tab (bag items or shop offers). */
export function tabRowCount(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): number {
  if (state.tab === "shop" && ctx.shop) {
    return shopOffers(save, ctx.shop.ctx, ctx.shop.id).length;
  }
  if (state.tab === "requests") {
    return ctx.shop?.id === "trader" ? (save.shops.requests ?? []).length : 0;
  }
  return bagRows(ctx, save, state).length;
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
  const pages = pageCount(tabRowCount(ctx, save, state));
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
    case "tab":
      return {
        save,
        state: {
          ...state,
          tab: cmd.tab,
          page: 0,
          selectedOffer: null,
          selectedUid: null,
          status: "",
        },
      };
    case "selectOffer":
      return {
        save,
        state: { ...state, selectedOffer: cmd.index, status: "" },
      };
    case "buy": {
      if (!ctx.shop || state.selectedOffer === null) return { save, state };
      const r = buyOffer(save, ctx.shop.ctx, ctx.shop.id, state.selectedOffer);
      const offers = shopOffers(r.save, ctx.shop.ctx, ctx.shop.id);
      const stillThere = state.selectedOffer < offers.length;
      return {
        save: r.save,
        state: clampPage(ctx, r.save, {
          ...state,
          selectedOffer: stillThere ? state.selectedOffer : null,
          status: r.message,
        }),
      };
    }
    case "upgradeShop": {
      if (!ctx.shop?.buildings) return { save, state };
      const r = upgradeShop(ctx.shop.buildings, save, ctx.shop.id);
      const next =
        r.result.kind === "upgraded"
          ? ensureShopStock(r.save, ctx.shop.ctx, ctx.shop.rng ?? Math.random)
          : r.save;
      return {
        save: next,
        state: clampPage(ctx, next, {
          ...state,
          selectedOffer: null,
          status: r.result.message,
        }),
      };
    }
    case "reroll": {
      if (ctx.shop?.id !== "trader") return { save, state };
      const r = rerollTrader(save, ctx.shop.ctx, ctx.shop.rng ?? Math.random);
      return {
        save: r.save,
        state: clampPage(ctx, r.save, {
          ...state,
          selectedOffer: null,
          page: 0,
          status: r.message,
        }),
      };
    }
    case "fillRequest": {
      if (ctx.shop?.id !== "trader" || state.selectedOffer === null) {
        return { save, state };
      }
      const r = fillTraderRequest(save, ctx.shop.ctx, state.selectedOffer);
      return {
        save: r.save,
        state: clampPage(ctx, r.save, {
          ...state,
          selectedOffer: r.ok ? null : state.selectedOffer,
          status: r.message,
        }),
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
