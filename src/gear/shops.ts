import bundledShops from "../../public/data/shops.json";
import { normalizeShops } from "../core/normalizeShops";
import type { SaveGame } from "../core/saveTypes";
import {
  addConsumable,
  getConsumablesConfig,
  type ConsumablesConfig,
} from "./consumables";
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

export type TraderConfig = {
  title: string;
  itemCount: number;
  minItemLevelOffset: number;
  maxItemLevelOffset: number;
  priceMulPct: number;
  rarityWeights: RarityWeights;
  consumables: { id: string; qty: number; chancePct: number }[];
};

export type BlacksmithConfig = {
  title: string;
  priceMulPct: number;
  items: { baseId: string; unlockNight: number }[];
  consumables: { id: string; unlockNight: number }[];
};

export type ShopsConfig = {
  trader: TraderConfig;
  blacksmith: BlacksmithConfig;
};

/** One row in a shop. `qty` is null for unlimited (blacksmith). */
export type ShopOffer =
  | { kind: "item"; item: ItemDraft; qty: number | null }
  | { kind: "consumable"; id: string; qty: number | null };

/** Saved shop state: trader stock for the current day (null = restock on next visit). */
export type SaveShops = { trader: ShopOffer[] | null };

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

/** Fresh trader stock: random items around the night's level plus consumables. */
export function rollTraderStock(
  ctx: ShopContext,
  night: number,
  rng: Rng,
): ShopOffer[] {
  const t = ctx.shops.trader;
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

/** Roll trader stock when the day has none yet (first visit after a night). */
export function ensureTraderStock(
  save: SaveGame,
  ctx: ShopContext,
  rng: Rng,
): SaveGame {
  if (save.shops.trader) return save;
  return {
    ...save,
    shops: { ...save.shops, trader: rollTraderStock(ctx, save.night, rng) },
  };
}

/** Blacksmith catalogue unlocked by `night`: plain common bases plus consumables. */
export function blacksmithOffers(ctx: ShopContext, night: number): ShopOffer[] {
  const b = ctx.shops.blacksmith;
  const out: ShopOffer[] = [];
  for (const row of b.items) {
    if (row.unlockNight > night) continue;
    if (!ctx.catalog.bases[row.baseId]) continue;
    const item = createBaseItem(ctx.catalog, row.baseId, 1);
    out.push({ kind: "item", item, qty: null });
  }
  for (const row of b.consumables) {
    if (row.unlockNight > night || !ctx.consumables.items[row.id]) continue;
    out.push({ kind: "consumable", id: row.id, qty: null });
  }
  return out;
}

/** Next blacksmith unlock after `night` (for the "more at night N" hint), or null. */
export function nextBlacksmithUnlock(
  ctx: ShopContext,
  night: number,
): number | null {
  const later = [
    ...ctx.shops.blacksmith.items,
    ...ctx.shops.blacksmith.consumables,
  ]
    .map((r) => r.unlockNight)
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
    : blacksmithOffers(ctx, save.night);
}

export function shopTitle(ctx: ShopContext, shop: ShopId): string {
  return ctx.shops[shop].title;
}

/** Gold price of an offer at this shop (null when its data row is gone). */
export function offerPrice(
  ctx: ShopContext,
  shop: ShopId,
  offer: ShopOffer,
): number | null {
  const mul = ctx.shops[shop].priceMulPct / 100;
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
  const price = offerPrice(ctx, shop, offer);
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
  if (shop === "trader" && offer.qty !== null) {
    const trader = [...offers];
    if (offer.qty <= 1) trader.splice(index, 1);
    else trader[index] = { ...offer, qty: offer.qty - 1 };
    next = { ...next, shops: { ...next.shops, trader } };
  }
  return { save: next, ok: true, message: `Bought ${name} for ${price}g` };
}

/** Saved shop block with bad rows dropped (missing → restock on next visit). */
export function normalizeSaveShops(raw: unknown): SaveShops {
  if (!raw || typeof raw !== "object") return { trader: null };
  const trader = (raw as { trader?: unknown }).trader;
  if (!Array.isArray(trader)) return { trader: null };
  const offers = trader.filter(
    (o): o is ShopOffer =>
      !!o &&
      typeof o === "object" &&
      ((o.kind === "item" && !!o.item && typeof o.item.baseId === "string") ||
        (o.kind === "consumable" && typeof o.id === "string")) &&
      (o.qty === null || typeof o.qty === "number"),
  );
  return { trader: offers };
}
