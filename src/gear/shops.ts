import bundledShops from "../../public/data/shops.json";
import { normalizeShops } from "../core/normalizeShops";
import type { SaveGame } from "../core/saveTypes";
import {
  addConsumable,
  getConsumablesConfig,
  type ConsumablesConfig,
} from "./consumables";
import {
  fillBuyRequest,
  normalizeSaveRequests,
  rollBuyRequests,
  type BuyRequest,
  type BuyRequestsConfig,
  type FillRequestResult,
} from "./buyRequests";
import { addItem, bagItems } from "./inventory";
import {
  createBaseItem,
  rollItem,
  type ItemDraft,
  type RarityWeights,
} from "./itemGen";
import { resolveItem } from "./itemStats";
import { getLootConfig, type LootConfig } from "./loot";
import type { GearCatalog } from "./gearTypes";
import { randInt, type Rng } from "./rng";

export const SHOP_IDS = ["trader", "blacksmith"] as const;
export type ShopId = (typeof SHOP_IDS)[number];

/** Trader fields a shop level can change. */
export type TraderLevelFields = {
  itemCount: number;
  minItemLevelOffset: number;
  maxItemLevelOffset: number;
  priceMulPct: number;
  rarityWeights: RarityWeights;
  /** Gold to reroll today's stock; 0 = no reroll. */
  rerollCost: number;
  /** Buy requests posted each night (see `requests`). */
  requestCount: number;
};

export type TraderConfig = TraderLevelFields & {
  title: string;
  consumables: { id: string; qty: number; chancePct: number }[];
  /** Nightly buy requests: payout and roll odds. */
  requests: BuyRequestsConfig;
  /** Upgrade levels 1..N: each row overrides the fields of the level below. */
  levels: Partial<TraderLevelFields>[];
};

/** Blacksmith fields a shop level can change. */
export type BlacksmithLevelFields = {
  priceMulPct: number;
  /** Rolled "masterwork" items stocked per day (qty 1 each). */
  stockCount: number;
  /** Offset added to the night for masterwork item levels. */
  stockItemLevelOffset: number;
  stockRarityWeights: RarityWeights;
  /** Catalogue rows unlock this many nights earlier. */
  unlockNightsEarly: number;
};

export type BlacksmithConfig = BlacksmithLevelFields & {
  title: string;
  items: { baseId: string; unlockNight: number }[];
  consumables: { id: string; unlockNight: number }[];
  levels: Partial<BlacksmithLevelFields>[];
};

export type ShopsConfig = {
  trader: TraderConfig;
  blacksmith: BlacksmithConfig;
};

/** One row in a shop. `qty` is null for unlimited (blacksmith). */
export type ShopOffer =
  | { kind: "item"; item: ItemDraft; qty: number | null }
  | { kind: "consumable"; id: string; qty: number | null };

/**
 * Saved shop state for the current day (null = restock on next visit):
 * trader stock, the blacksmith's masterwork stock and the trader's buy
 * requests (missing / null = roll on next visit).
 */
export type SaveShops = {
  trader: ShopOffer[] | null;
  blacksmith: ShopOffer[] | null;
  requests?: BuyRequest[] | null;
};

let active: ShopsConfig | null = null;

export function setShopsConfig(config: ShopsConfig): void {
  active = config;
}

/** Active shop config; falls back to the bundled `shops.json` before Boot. */
export function getShopsConfig(): ShopsConfig {
  if (!active) active = normalizeShops(bundledShops);
  return active;
}

export type ShopContext = {
  catalog: GearCatalog;
  consumables: ConsumablesConfig;
  shops: ShopsConfig;
  loot: LootConfig;
};

export function defaultShopContext(catalog: GearCatalog): ShopContext {
  return {
    catalog,
    consumables: getConsumablesConfig(),
    shops: getShopsConfig(),
    loot: getLootConfig(),
  };
}

/** Upgrade level bought for a shop (`save.buildings`), capped to its data. */
export function shopLevel(
  save: SaveGame,
  ctx: ShopContext,
  shop: ShopId,
): number {
  const level = Math.floor(save.buildings[shop] ?? 0);
  return Math.max(0, Math.min(level, ctx.shops[shop].levels.length));
}

/** Number of upgrade levels defined for a shop. */
export function shopMaxLevel(ctx: ShopContext, shop: ShopId): number {
  return ctx.shops[shop].levels.length;
}

/** Trader settings at an upgrade level (level rows stack in order). */
export function traderAt(ctx: ShopContext, level: number): TraderConfig {
  let t = ctx.shops.trader;
  for (const row of t.levels.slice(0, level)) t = { ...t, ...row };
  return t;
}

/** Blacksmith settings at an upgrade level (level rows stack in order). */
export function blacksmithAt(
  ctx: ShopContext,
  level: number,
): BlacksmithConfig {
  let b = ctx.shops.blacksmith;
  for (const row of b.levels.slice(0, level)) b = { ...b, ...row };
  return b;
}

function shopAt(
  ctx: ShopContext,
  shop: ShopId,
  level: number,
): TraderConfig | BlacksmithConfig {
  return shop === "trader" ? traderAt(ctx, level) : blacksmithAt(ctx, level);
}

/** Fresh trader stock: random items around the night's level plus consumables. */
export function rollTraderStock(
  ctx: ShopContext,
  night: number,
  rng: Rng,
  level = 0,
): ShopOffer[] {
  const t = traderAt(ctx, level);
  const out: ShopOffer[] = [];
  for (let i = 0; i < t.itemCount; i++) {
    const itemLevel = Math.max(
      1,
      night + randInt(rng, t.minItemLevelOffset, t.maxItemLevelOffset),
    );
    const item = rollItem(ctx.catalog, rng, {
      itemLevel,
      rarityWeights: t.rarityWeights,
    });
    if (item) out.push({ kind: "item", item, qty: 1 });
  }
  for (const c of t.consumables) {
    if (!ctx.consumables.items[c.id]) continue;
    if (rng() * 100 < c.chancePct) {
      out.push({ kind: "consumable", id: c.id, qty: c.qty });
    }
  }
  return out;
}

/** Blacksmith masterwork stock: rolled items at the night's level (upgrades only). */
export function rollBlacksmithStock(
  ctx: ShopContext,
  night: number,
  rng: Rng,
  level = 0,
): ShopOffer[] {
  const b = blacksmithAt(ctx, level);
  const out: ShopOffer[] = [];
  for (let i = 0; i < b.stockCount; i++) {
    const item = rollItem(ctx.catalog, rng, {
      itemLevel: Math.max(1, night + b.stockItemLevelOffset),
      rarityWeights: b.stockRarityWeights,
    });
    if (item) out.push({ kind: "item", item, qty: 1 });
  }
  return out;
}

/** Roll the day's trader / blacksmith stock when missing (first visit after a night). */
export function ensureShopStock(
  save: SaveGame,
  ctx: ShopContext,
  rng: Rng,
): SaveGame {
  if (save.shops.trader && save.shops.blacksmith && save.shops.requests) {
    return save;
  }
  const traderLevel = shopLevel(save, ctx, "trader");
  return {
    ...save,
    shops: {
      requests:
        save.shops.requests ??
        rollBuyRequests(
          ctx.catalog,
          ctx.shops.trader.requests,
          traderAt(ctx, traderLevel).requestCount,
          rng,
        ),
      trader:
        save.shops.trader ??
        rollTraderStock(ctx, save.night, rng, traderLevel),
      blacksmith:
        save.shops.blacksmith ??
        rollBlacksmithStock(
          ctx,
          save.night,
          rng,
          shopLevel(save, ctx, "blacksmith"),
        ),
    },
  };
}

/** Sell the best matching bag item to the trader's buy request `index`. */
export function fillTraderRequest(
  save: SaveGame,
  ctx: ShopContext,
  index: number,
): FillRequestResult {
  return fillBuyRequest(save, ctx.catalog, ctx.shops.trader.requests, index);
}

/** Pay `rerollCost` for fresh trader stock (needs a trader upgrade). */
export function rerollTrader(
  save: SaveGame,
  ctx: ShopContext,
  rng: Rng,
): BuyResult {
  const level = shopLevel(save, ctx, "trader");
  const cost = traderAt(ctx, level).rerollCost;
  if (cost <= 0) {
    return { save, ok: false, message: "Upgrade the trader to reroll" };
  }
  if (save.gold < cost) {
    return { save, ok: false, message: `Need ${cost}g (have ${save.gold}g)` };
  }
  return {
    save: {
      ...save,
      gold: save.gold - cost,
      shops: {
        ...save.shops,
        trader: rollTraderStock(ctx, save.night, rng, level),
      },
    },
    ok: true,
    message: `New stock for ${cost}g`,
  };
}

/**
 * Blacksmith offers: the day's masterwork `stock` first, then the catalogue
 * unlocked by `night` (plain common bases) and consumables.
 */
export function blacksmithOffers(
  ctx: ShopContext,
  night: number,
  level = 0,
  stock: readonly ShopOffer[] = [],
): ShopOffer[] {
  const b = blacksmithAt(ctx, level);
  const unlockedBy = night + b.unlockNightsEarly;
  const out: ShopOffer[] = [...stock];
  for (const row of b.items) {
    if (row.unlockNight > unlockedBy) continue;
    if (!ctx.catalog.bases[row.baseId]) continue;
    const item = createBaseItem(ctx.catalog, row.baseId, 1);
    out.push({ kind: "item", item, qty: null });
  }
  for (const row of b.consumables) {
    if (row.unlockNight > unlockedBy || !ctx.consumables.items[row.id]) {
      continue;
    }
    out.push({ kind: "consumable", id: row.id, qty: null });
  }
  return out;
}

/** Next blacksmith unlock after `night` (for the "more at night N" hint), or null. */
export function nextBlacksmithUnlock(
  ctx: ShopContext,
  night: number,
  level = 0,
): number | null {
  const early = blacksmithAt(ctx, level).unlockNightsEarly;
  const later = [
    ...ctx.shops.blacksmith.items,
    ...ctx.shops.blacksmith.consumables,
  ]
    .map((r) => Math.max(1, r.unlockNight - early))
    .filter((n) => n > night);
  return later.length ? Math.min(...later) : null;
}

export function shopOffers(
  save: SaveGame,
  ctx: ShopContext,
  shop: ShopId,
): ShopOffer[] {
  return shop === "trader"
    ? (save.shops.trader ?? [])
    : blacksmithOffers(
        ctx,
        save.night,
        shopLevel(save, ctx, "blacksmith"),
        save.shops.blacksmith ?? [],
      );
}

export function shopTitle(ctx: ShopContext, shop: ShopId): string {
  return ctx.shops[shop].title;
}

/** Gold price of an offer at this shop level (null when its data row is gone). */
export function offerPrice(
  ctx: ShopContext,
  shop: ShopId,
  offer: ShopOffer,
  level = 0,
): number | null {
  const mul = shopAt(ctx, shop, level).priceMulPct / 100;
  if (offer.kind === "consumable") {
    const def = ctx.consumables.items[offer.id];
    return def ? Math.max(1, Math.round(def.price * mul)) : null;
  }
  const r = resolveItem(ctx.catalog, { ...offer.item, uid: 0 });
  return r ? Math.max(1, Math.round(r.price * mul)) : null;
}

export type BuyResult = { save: SaveGame; ok: boolean; message: string };

/** Buy one unit of an offer: checks gold, bag space and stack size. */
export function buyOffer(
  save: SaveGame,
  ctx: ShopContext,
  shop: ShopId,
  index: number,
): BuyResult {
  const offers = shopOffers(save, ctx, shop);
  const offer = offers[index];
  if (!offer || offer.qty === 0) {
    return { save, ok: false, message: "Sold out" };
  }
  const price = offerPrice(ctx, shop, offer, shopLevel(save, ctx, shop));
  if (price === null)
    return { save, ok: false, message: "No longer available" };
  if (save.gold < price) {
    return { save, ok: false, message: `Need ${price}g (have ${save.gold}g)` };
  }
  let next: SaveGame;
  let name: string;
  if (offer.kind === "item") {
    if (bagItems(save.gear).length >= ctx.loot.inventoryCapacity) {
      return { save, ok: false, message: "Bag is full — sell something first" };
    }
    next = { ...save, gear: addItem(save.gear, offer.item).gear };
    name = resolveItem(ctx.catalog, { ...offer.item, uid: 0 })?.name ?? "item";
  } else {
    const r = addConsumable(save, offer.id, 1, ctx.consumables);
    if (r.added === 0) {
      return { save, ok: false, message: "You can't carry more of those" };
    }
    next = r.save;
    name = ctx.consumables.items[offer.id]!.name;
  }
  next = { ...next, gold: next.gold - price };
  if (offer.qty !== null) {
    // Limited rows live in the saved stock (trader list / blacksmith masterworks first).
    // Only saved stock rows (trader list, blacksmith masterworks) have a qty.
    const stock = [...save.shops[shop]!];
    if (offer.qty <= 1) stock.splice(index, 1);
    else stock[index] = { ...offer, qty: offer.qty - 1 };
    next = { ...next, shops: { ...next.shops, [shop]: stock } };
  }
  return { save: next, ok: true, message: `Bought ${name} for ${price}g` };
}

/** Saved shop block with bad rows dropped (missing → restock on next visit). */
export function normalizeSaveShops(raw: unknown): SaveShops {
  const block = raw && typeof raw === "object" ? (raw as SaveShopsRaw) : {};
  return {
    trader: normalizeStock(block.trader),
    blacksmith: normalizeStock(block.blacksmith),
    requests: normalizeSaveRequests(block.requests),
  };
}

type SaveShopsRaw = {
  trader?: unknown;
  blacksmith?: unknown;
  requests?: unknown;
};

function normalizeStock(list: unknown): ShopOffer[] | null {
  if (!Array.isArray(list)) return null;
  return list.filter(
    (o): o is ShopOffer =>
      !!o &&
      typeof o === "object" &&
      ((o.kind === "item" && !!o.item && typeof o.item.baseId === "string") ||
        (o.kind === "consumable" && typeof o.id === "string")) &&
      (o.qty === null || typeof o.qty === "number"),
  );
}
