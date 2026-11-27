import { consumableCount, getConsumablesConfig } from "../../gear/consumables";
import { debugEconomyPolicy } from "../../debug/debugEconomy";
import type { ConsumableDef } from "../../gear/consumableTypes";
import {
  bagItems,
  equipItem,
  equippedSlotOf,
  findItem,
  nextSortMode,
  removeItem,
  unequipSlot,
  type ItemSortMode,
} from "../../gear/inventory";
import {
  resolveItem,
  sellValue,
  type ResolvedItem,
} from "../../gear/itemStats";
import type { LootConfig } from "../../gear/loot";
import {
  RARITY_IDS,
  type EquipSlot,
  type GearCatalog,
  type ItemType,
} from "../../gear/gearTypes";
import type { SaveGame } from "../../core/saveTypes";
import type { BuildingDef } from "../../core/DataStore";
import type { Rng } from "../../gear/rng";
import {
  buyOffer,
  ensureShopStock,
  fillTraderRequest,
  offerPrice,
  rerollTrader,
  shopLevel,
  shopOffers,
  type ShopContext,
  type ShopId,
} from "../../gear/shops";
import { upgradeShop } from "../../systems/townBuildingMenu";

/** Shop card grid: 2 columns × 6 rows, or × 5 when the "Coming soon" row shows. */
export const SHOP_CARDS_PER_PAGE = 12;
export const SHOP_CARDS_PER_PAGE_WITH_LOCKED = 10;
/** Inventory bag grid: 7 × 3 tiles per page. */
export const BAG_TILES_PER_PAGE = 21;

/**
 * `shop` = Buy tab, `bag` = Sell tab (shops) / the bag grid (inventory),
 * `requests` = the trader's buy requests ("Wants", trader only).
 */
export type GearPanelTab = "bag" | "shop" | "requests";
/** Inventory tabs. */
export type GearPanelView = "gear" | "consumables";

export const GEAR_FILTERS = [
  "all",
  "weapons",
  "armour",
  "jewellery",
  "consumables",
] as const;
export type GearFilter = (typeof GEAR_FILTERS)[number];

export type GearPanelState = {
  tab: GearPanelTab;
  view: GearPanelView;
  filter: GearFilter;
  /** Selected shop offer index (shop tab) or request index (requests tab). */
  selectedOffer: number | null;
  sort: ItemSortMode;
  page: number;
  /** Selected owned item (bag or equipped). */
  selectedUid: number | null;
  /** Selected consumable id (inventory Consumables tab). */
  selectedConsumable: string | null;
  status: string;
};

export type GearPanelCommand =
  | { type: "select"; uid: number | null }
  | { type: "selectSlot"; slot: EquipSlot }
  | { type: "selectConsumable"; id: string | null }
  | { type: "page"; delta: number }
  | { type: "sort" }
  | { type: "filter"; filter: GearFilter }
  | { type: "view"; view: GearPanelView }
  | { type: "equip" }
  | { type: "unequip" }
  | { type: "sell" }
  | { type: "tab"; tab: GearPanelTab }
  | { type: "selectOffer"; index: number | null }
  | { type: "buy" }
  | { type: "buyEquip" }
  | { type: "upgradeShop" }
  | { type: "reroll" }
  | { type: "fillRequest" };

export type GearPanelContext = {
  catalog: GearCatalog;
  loot: LootConfig;
  /** Session debug flags (infinite gold, etc.) from the host scene. */
  registry?: Phaser.Data.DataManager;
  /**
   * When set the panel is a shop (Buy + Sell tabs). `buildings` holds the
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
    view: "gear",
    filter: "all",
    selectedOffer: null,
    sort: "slot",
    page: 0,
    selectedUid: null,
    selectedConsumable: null,
    status: "",
  };
}

const FILTER_TYPES: Record<
  Exclude<GearFilter, "all" | "consumables">,
  ItemType[]
> = {
  weapons: ["meleeWeapon", "rangedWeapon"],
  armour: ["helm", "chest", "hands", "legs", "boots"],
  jewellery: ["ring", "trinket"],
};

const TYPE_ORDER: ItemType[] = [
  ...FILTER_TYPES.weapons,
  ...FILTER_TYPES.armour,
  ...FILTER_TYPES.jewellery,
];

/** One card / tile in a panel list (shop offer, bag item or carried consumable). */
export type PanelEntry =
  | {
      kind: "item";
      /** Shop: offer index. Bag: item uid. */
      key: number;
      item: ResolvedItem;
      /** Shop price (buy tab) or sell value (bag); null when the data row is gone. */
      price: number | null;
      /** Units left (limited shop rows); null = unlimited / owned. */
      qty: number | null;
    }
  | {
      kind: "consumable";
      key: number;
      def: ConsumableDef;
      price: number | null;
      qty: number | null;
      /** How many the player carries. */
      count: number;
    };

/** Whether an entry passes a filter chip. */
export function entryMatches(entry: PanelEntry, filter: GearFilter): boolean {
  if (filter === "all") return true;
  if (filter === "consumables") return entry.kind === "consumable";
  return (
    entry.kind === "item" && FILTER_TYPES[filter].includes(entry.item.base.type)
  );
}

function sortKey(entry: PanelEntry, mode: ItemSortMode): number[] {
  if (entry.kind === "consumable") {
    // Consumables trail the gear in every mode.
    return [1, -(entry.price ?? 0)];
  }
  const r = entry.item;
  const rarity = RARITY_IDS.indexOf(r.item.rarity);
  const price = r.price;
  const keys: Record<ItemSortMode, number[]> = {
    slot: [TYPE_ORDER.indexOf(r.base.type), -r.item.itemLevel, -rarity],
    rarity: [-rarity, -price],
    value: [-price],
    level: [-r.item.itemLevel, -rarity],
  };
  return [0, ...keys[mode]];
}

/** Stable sort of entries by `mode` (ties keep shop / bag order). */
export function sortEntries(
  entries: readonly PanelEntry[],
  mode: ItemSortMode,
): PanelEntry[] {
  return entries
    .map((e, i) => ({ e, i, k: sortKey(e, mode) }))
    .sort((a, b) => {
      const n = Math.max(a.k.length, b.k.length);
      for (let j = 0; j < n; j++) {
        const d = (a.k[j] ?? 0) - (b.k[j] ?? 0);
        if (d !== 0) return d;
      }
      return a.i - b.i;
    })
    .map((x) => x.e);
}

/** Every shop offer as an entry (unsorted, unfiltered; key = offer index). */
export function shopEntries(
  ctx: GearPanelContext,
  save: SaveGame,
): PanelEntry[] {
  if (!ctx.shop) return [];
  const { id, ctx: shopCtx } = ctx.shop;
  const level = shopLevel(save, shopCtx, id);
  const out: PanelEntry[] = [];
  shopOffers(save, shopCtx, id).forEach((offer, key) => {
    const price = offerPrice(shopCtx, id, offer, level);
    if (offer.kind === "consumable") {
      const def = shopCtx.consumables.items[offer.id];
      if (!def) return;
      out.push({
        kind: "consumable",
        key,
        def,
        price,
        qty: offer.qty,
        count: consumableCount(save, def.id),
      });
      return;
    }
    const item = resolveItem(ctx.catalog, { ...offer.item, uid: 0 });
    if (item) out.push({ kind: "item", key, item, price, qty: offer.qty });
  });
  return out;
}

/** Unequipped bag items as entries priced at their sell value (key = uid). */
export function bagEntries(
  ctx: GearPanelContext,
  save: SaveGame,
): PanelEntry[] {
  const out: PanelEntry[] = [];
  for (const i of bagItems(save.gear)) {
    const item = resolveItem(ctx.catalog, i);
    if (!item) continue;
    out.push({
      kind: "item",
      key: i.uid,
      item,
      price: sellValue(item.price, ctx.loot.sellBackPct),
      qty: null,
    });
  }
  return out;
}

function consumableDefs(ctx: GearPanelContext): ConsumableDef[] {
  return Object.values(
    (ctx.shop?.ctx.consumables ?? getConsumablesConfig()).items,
  );
}

/** Carried potions / bombs (key = index in this list). */
export function carriedConsumables(
  ctx: GearPanelContext,
  save: SaveGame,
): PanelEntry[] {
  return consumableDefs(ctx)
    .filter((d) => consumableCount(save, d.id) > 0)
    .map((def, key) => ({
      kind: "consumable" as const,
      key,
      def,
      price: null,
      qty: null,
      count: consumableCount(save, def.id),
    }));
}

/** The active list (filtered + sorted) for the panel's tab / view. */
export function listEntries(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): PanelEntry[] {
  if (!ctx.shop && state.view === "consumables") {
    return carriedConsumables(ctx, save);
  }
  // Buy requests are listed by requestPanelLogic, not as cards.
  if (state.tab === "requests") return [];
  const all =
    state.tab === "shop" && ctx.shop
      ? shopEntries(ctx, save)
      : bagEntries(ctx, save);
  return sortEntries(
    all.filter((e) => entryMatches(e, state.filter)),
    state.sort,
  );
}

/** Cards / tiles per page for this panel and tab. */
export function pageSize(ctx: GearPanelContext, hasLockedRow: boolean): number {
  if (!ctx.shop) return BAG_TILES_PER_PAGE;
  return hasLockedRow ? SHOP_CARDS_PER_PAGE_WITH_LOCKED : SHOP_CARDS_PER_PAGE;
}

export function pageCount(rowCount: number, perPage: number): number {
  return Math.max(1, Math.ceil(rowCount / perPage));
}

export function visibleRows<T>(
  rows: readonly T[],
  page: number,
  perPage: number,
): T[] {
  const start = page * perPage;
  return rows.slice(start, start + perPage);
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

/**
 * Clamp the page to the list. `perPage` comes from the panel (the shop grid
 * loses a row when "Coming soon" shows).
 */
export function clampPage(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
  perPage = pageSize(ctx, false),
): GearPanelState {
  const pages = pageCount(listEntries(ctx, save, state).length, perPage);
  return { ...state, page: Math.min(Math.max(0, state.page), pages - 1) };
}

const cleared = (state: GearPanelState): GearPanelState => ({
  ...state,
  page: 0,
  selectedOffer: null,
  selectedUid: null,
  selectedConsumable: null,
  status: "",
});

/** Apply a panel command; returns the next save (unchanged unless gear / gold changed). */
export function reduceGearPanel(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
  cmd: GearPanelCommand,
  perPage?: number,
): { save: SaveGame; state: GearPanelState } {
  const sel = selectedItem(ctx, save, state);
  const clamp = (s: SaveGame, st: GearPanelState) =>
    clampPage(ctx, s, st, perPage);
  switch (cmd.type) {
    case "select":
      return {
        save,
        state: {
          ...state,
          // Tapping the selected tile again clears the selection.
          selectedUid: cmd.uid === state.selectedUid ? null : cmd.uid,
          status: "",
        },
      };
    case "selectSlot": {
      const uid = save.gear.equipped[cmd.slot] ?? null;
      return {
        save,
        state: {
          ...state,
          selectedUid: uid !== null && uid === state.selectedUid ? null : uid,
          status: "",
        },
      };
    }
    case "selectConsumable":
      return {
        save,
        state: {
          ...state,
          selectedConsumable:
            cmd.id === state.selectedConsumable ? null : cmd.id,
          status: "",
        },
      };
    case "page":
      return {
        save,
        state: clamp(save, { ...state, page: state.page + cmd.delta }),
      };
    case "sort":
      return {
        save,
        state: { ...state, sort: nextSortMode(state.sort), page: 0 },
      };
    case "filter":
      return { save, state: { ...cleared(state), filter: cmd.filter } };
    case "view":
      return { save, state: { ...cleared(state), view: cmd.view } };
    case "equip": {
      if (!sel || equippedSlotOf(save.gear, sel.item.uid))
        return { save, state };
      const gear = equipItem(ctx.catalog, save.gear, sel.item.uid);
      const next = { ...save, gear };
      return {
        save: next,
        state: clamp(next, { ...state, status: `Equipped ${sel.name}` }),
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
      return { save, state: { ...cleared(state), tab: cmd.tab } };
    case "selectOffer":
      return {
        save,
        state: {
          ...state,
          selectedOffer: cmd.index === state.selectedOffer ? null : cmd.index,
          status: "",
        },
      };
    case "buy":
    case "buyEquip": {
      if (!ctx.shop || state.selectedOffer === null) return { save, state };
      const offer = shopOffers(save, ctx.shop.ctx, ctx.shop.id)[
        state.selectedOffer
      ];
      const r = buyOffer(
        save,
        ctx.shop.ctx,
        ctx.shop.id,
        state.selectedOffer,
        ctx.registry && debugEconomyPolicy(ctx.registry),
      );
      let next = r.save;
      let status = r.message;
      if (r.ok && cmd.type === "buyEquip" && offer?.kind === "item") {
        // addItem gives the new item the save's nextUid.
        const uid = save.gear.nextUid;
        next = { ...next, gear: equipItem(ctx.catalog, next.gear, uid) };
        status = `${r.message} and equipped it`;
      }
      const offers = shopOffers(next, ctx.shop.ctx, ctx.shop.id);
      // A limited row bought out is spliced from the list: drop the selection.
      const stillThere =
        state.selectedOffer < offers.length && (!r.ok || offer?.qty !== 1);
      return {
        save: next,
        state: clamp(next, {
          ...state,
          selectedOffer: stillThere ? state.selectedOffer : null,
          status,
        }),
      };
    }
    case "upgradeShop": {
      if (!ctx.shop?.buildings) return { save, state };
      const r = upgradeShop(
        ctx.shop.buildings,
        save,
        ctx.shop.id,
        ctx.registry && debugEconomyPolicy(ctx.registry),
      );
      const next =
        r.result.kind === "upgraded"
          ? ensureShopStock(r.save, ctx.shop.ctx, ctx.shop.rng ?? Math.random)
          : r.save;
      return {
        save: next,
        state: clamp(next, {
          ...state,
          selectedOffer: null,
          status: r.result.message,
        }),
      };
    }
    case "reroll": {
      if (ctx.shop?.id !== "trader") return { save, state };
      const r = rerollTrader(
        save,
        ctx.shop.ctx,
        ctx.shop.rng ?? Math.random,
        ctx.registry && debugEconomyPolicy(ctx.registry),
      );
      return {
        save: r.save,
        state: clamp(r.save, {
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
        state: clamp(r.save, {
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
        state: clamp(next, {
          ...state,
          selectedUid: null,
          status: `Sold ${sel.name} for ${gold}g`,
        }),
      };
    }
  }
}
