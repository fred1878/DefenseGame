import type { SaveGame } from "../core/saveTypes";
import { itemTypeLabel } from "./gearText";
import {
  ITEM_TYPES,
  RARITY_IDS,
  type GearCatalog,
  type ItemType,
  type RarityId,
} from "./gearTypes";
import { bagItems, removeItem } from "./inventory";
import type { RarityWeights } from "./itemGen";
import { resolveItem, type ResolvedItem } from "./itemStats";
import { pickWeighted, type Rng } from "./rng";

/**
 * A trader "buy request": the trader pays `payoutPct` of an item's value for
 * one matching item. Requests are rolled from the whole item pool, so the
 * player may never own (or be able to get) a match.
 */
export type BuyRequest =
  /** One specific base item (any rarity, uniques on that base too). */
  | { kind: "base"; baseId: string }
  /** Any item of a type at or above a rarity (e.g. "Rare+ Ring"). */
  | { kind: "type"; itemType: ItemType; minRarity: RarityId }
  /** One specific unique. */
  | { kind: "unique"; uniqueId: string };

export type BuyRequestKind = BuyRequest["kind"];
export const BUY_REQUEST_KINDS = ["base", "type", "unique"] as const;

/** `shops.json` → `trader.requests`. */
export type BuyRequestsConfig = {
  /** Gold paid as a percent of the item's value (its shop price). */
  payoutPct: number;
  /** Relative odds of each request kind. */
  kindWeights: Record<BuyRequestKind, number>;
  /** Minimum-rarity odds for `type` requests. */
  minRarityWeights: RarityWeights;
};

/** How many times a duplicate request is rerolled before it is kept. */
const DUPLICATE_RETRIES = 6;

function sameRequest(a: BuyRequest, b: BuyRequest): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function rollOne(
  catalog: GearCatalog,
  config: BuyRequestsConfig,
  rng: Rng,
): BuyRequest | null {
  const baseIds = Object.keys(catalog.bases);
  const uniqueIds = Object.keys(catalog.uniques);
  const types = ITEM_TYPES.filter((t) =>
    Object.values(catalog.bases).some((b) => b.type === t),
  );
  const available: Record<BuyRequestKind, boolean> = {
    base: baseIds.length > 0,
    type: types.length > 0,
    unique: uniqueIds.length > 0,
  };
  const kind = pickWeighted(rng, BUY_REQUEST_KINDS, (k) =>
    available[k] ? config.kindWeights[k] : 0,
  );
  if (kind === "base") {
    return {
      kind,
      baseId: baseIds[Math.floor(rng() * baseIds.length)]!,
    };
  }
  if (kind === "unique") {
    return {
      kind,
      uniqueId: uniqueIds[Math.floor(rng() * uniqueIds.length)]!,
    };
  }
  if (kind === "type") {
    const minRarity =
      pickWeighted(rng, RARITY_IDS, (r) => config.minRarityWeights[r] ?? 0) ??
      "magic";
    return {
      kind,
      itemType: types[Math.floor(rng() * types.length)]!,
      minRarity,
    };
  }
  return null;
}

/** Roll `count` requests (duplicates avoided where the pool allows). */
export function rollBuyRequests(
  catalog: GearCatalog,
  config: BuyRequestsConfig,
  count: number,
  rng: Rng,
): BuyRequest[] {
  const out: BuyRequest[] = [];
  for (let i = 0; i < count; i++) {
    let pick = rollOne(catalog, config, rng);
    for (
      let retry = 0;
      pick &&
      retry < DUPLICATE_RETRIES &&
      out.some((r) => sameRequest(r, pick!));
      retry++
    ) {
      pick = rollOne(catalog, config, rng);
    }
    if (pick) out.push(pick);
  }
  return out;
}

function rarityRank(id: RarityId): number {
  return RARITY_IDS.indexOf(id);
}

/** Does a resolved item satisfy a request? */
export function requestMatches(
  request: BuyRequest,
  item: ResolvedItem,
): boolean {
  switch (request.kind) {
    case "base":
      return item.item.baseId === request.baseId;
    case "unique":
      return item.item.uniqueId === request.uniqueId;
    case "type":
      return (
        item.base.type === request.itemType &&
        rarityRank(item.item.rarity) >= rarityRank(request.minRarity)
      );
  }
}

/** Gold the trader pays for `item` against a request. */
export function requestPayout(
  item: ResolvedItem,
  config: BuyRequestsConfig,
): number {
  return Math.max(1, Math.round((item.price * config.payoutPct) / 100));
}

/** Bag items (not equipped) that match, best payout first. */
export function requestMatchesInBag(
  save: SaveGame,
  catalog: GearCatalog,
  request: BuyRequest,
): ResolvedItem[] {
  return bagItems(save.gear)
    .map((i) => resolveItem(catalog, i))
    .filter((r): r is ResolvedItem => !!r && requestMatches(request, r))
    .sort((a, b) => b.price - a.price);
}

/** Display name and colour for a request row. */
export function describeRequest(
  catalog: GearCatalog,
  request: BuyRequest,
): { name: string; color: string } {
  switch (request.kind) {
    case "base":
      return {
        name: catalog.bases[request.baseId]?.name ?? "Unknown item",
        color: catalog.rarities.common.color,
      };
    case "unique":
      return {
        name: catalog.uniques[request.uniqueId]?.name ?? "Unknown unique",
        color: catalog.rarities.legendary.color,
      };
    case "type": {
      const rarity = catalog.rarities[request.minRarity];
      const plus = request.minRarity === "legendary" ? "" : "+";
      return {
        name: `${rarity.label}${plus} ${itemTypeLabel(request.itemType)}`,
        color: rarity.color,
      };
    }
  }
}

export type FillRequestResult = {
  save: SaveGame;
  ok: boolean;
  message: string;
  /** Gold paid (0 when not filled). */
  gold: number;
};

/**
 * Sell the best-paying matching bag item to request `index`; the request is
 * used up. `requests` is the saved list (`save.shops.requests`).
 */
export function fillBuyRequest(
  save: SaveGame,
  catalog: GearCatalog,
  config: BuyRequestsConfig,
  index: number,
): FillRequestResult {
  const requests = save.shops.requests ?? [];
  const request = requests[index];
  if (!request) {
    return { save, ok: false, message: "Request gone", gold: 0 };
  }
  const best = requestMatchesInBag(save, catalog, request)[0];
  if (!best) {
    return {
      save,
      ok: false,
      message: "No matching item in your bag",
      gold: 0,
    };
  }
  const gold = requestPayout(best, config);
  return {
    save: {
      ...save,
      gold: save.gold + gold,
      gear: removeItem(save.gear, best.item.uid),
      shops: {
        ...save.shops,
        requests: requests.filter((_, i) => i !== index),
      },
    },
    ok: true,
    message: `Trader paid ${gold}g for ${best.name}`,
    gold,
  };
}

/** Saved request list with bad rows dropped (missing → roll on next visit). */
export function normalizeSaveRequests(raw: unknown): BuyRequest[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((r): r is BuyRequest => {
    if (!r || typeof r !== "object") return false;
    const o = r as Record<string, unknown>;
    if (o.kind === "base") return typeof o.baseId === "string";
    if (o.kind === "unique") return typeof o.uniqueId === "string";
    return (
      o.kind === "type" &&
      ITEM_TYPES.includes(o.itemType as ItemType) &&
      RARITY_IDS.includes(o.minRarity as RarityId)
    );
  });
}
