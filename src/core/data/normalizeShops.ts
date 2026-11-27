import {
  BUY_REQUEST_KINDS,
  type BuyRequestKind,
  type BuyRequestsConfig,
} from "../../gear/buyRequests";
import { RARITY_IDS, type RarityId } from "../../gear/gearTypes";
import type {
  BlacksmithConfig,
  BlacksmithLevelFields,
  ShopsConfig,
  TraderConfig,
  TraderLevelFields,
} from "../../gear/shops";
import {
  optionalFiniteNumber,
  requireFiniteNumber,
  requireNumberFields,
  requireRecord,
} from "./configValidation";
import { requireArray, requireOneOf, requireString } from "./normalizeItems";

export const SHOPS_FILE_BOOT_KEYS = ["trader", "blacksmith"] as const;
export const SHOPS_TRADER_BOOT_KEYS = [
  "title",
  "itemCount",
  "minItemLevelOffset",
  "maxItemLevelOffset",
  "priceMulPct",
  "rarityWeights",
  "rerollCost",
  "consumables",
  "id",
  "qty",
  "chancePct",
  "levels",
  "requestCount",
  "requests",
  "payoutPct",
  "kindWeights",
  "minRarityWeights",
] as const;
export const SHOPS_BLACKSMITH_BOOT_KEYS = [
  "items",
  "baseId",
  "unlockNight",
  "stockCount",
  "stockItemLevelOffset",
  "stockRarityWeights",
  "unlockNightsEarly",
] as const;

const TRADER_NUMBER_FIELDS = [
  "itemCount",
  "minItemLevelOffset",
  "maxItemLevelOffset",
  "priceMulPct",
  "rerollCost",
  "requestCount",
] as const;
const BLACKSMITH_NUMBER_FIELDS = [
  "priceMulPct",
  "stockCount",
  "stockItemLevelOffset",
  "unlockNightsEarly",
] as const;

function rarityWeights(
  raw: unknown,
  path: string,
): Partial<Record<RarityId, number>> {
  const w = requireRecord(raw, path);
  // Rarities missing from a shop's weights never roll (same as loot bands).
  const out: Partial<Record<RarityId, number>> = Object.fromEntries(
    RARITY_IDS.map((r) => [r, 0]),
  );
  for (const [k, v] of Object.entries(w)) {
    const id = requireOneOf(k, RARITY_IDS, path);
    out[id] = requireFiniteNumber(v, `${path}.${k}`);
  }
  return out;
}

/** Optional numeric fields + optional rarity weights for one level row. */
function levelRow<T extends object>(
  raw: unknown,
  path: string,
  numberFields: readonly string[],
  weightsKey: string,
): Partial<T> {
  const r = requireRecord(raw, path);
  const out: Record<string, unknown> = {};
  for (const key of numberFields) {
    const v = optionalFiniteNumber(r[key], `${path}.${key}`);
    if (v !== undefined) out[key] = v;
  }
  if (r[weightsKey] !== undefined) {
    out[weightsKey] = rarityWeights(r[weightsKey], `${path}.${weightsKey}`);
  }
  return out as Partial<T>;
}

function levels<T extends object>(
  row: Record<string, unknown>,
  path: string,
  numberFields: readonly string[],
  weightsKey: string,
): Partial<T>[] {
  if (row.levels === undefined) return [];
  return requireArray(row.levels, `${path}.levels`).map((l, i) =>
    levelRow<T>(l, `${path}.levels[${i}]`, numberFields, weightsKey),
  );
}

const DEFAULT_REQUESTS: BuyRequestsConfig = {
  payoutPct: 150,
  kindWeights: { base: 1, type: 1, unique: 1 },
  minRarityWeights: { common: 0, magic: 1, rare: 0, epic: 0, legendary: 0 },
};

function normalizeRequests(raw: unknown, path: string): BuyRequestsConfig {
  if (raw === undefined) return structuredClone(DEFAULT_REQUESTS);
  const r = requireRecord(raw, path);
  const kindWeights = { ...DEFAULT_REQUESTS.kindWeights };
  if (r.kindWeights !== undefined) {
    const w = requireRecord(r.kindWeights, `${path}.kindWeights`);
    // Kinds missing from the weights never roll.
    for (const k of BUY_REQUEST_KINDS) kindWeights[k] = 0;
    for (const [k, v] of Object.entries(w)) {
      const kind: BuyRequestKind = requireOneOf(
        k,
        BUY_REQUEST_KINDS,
        `${path}.kindWeights`,
      );
      kindWeights[kind] = requireFiniteNumber(v, `${path}.kindWeights.${k}`);
    }
  }
  return {
    payoutPct:
      optionalFiniteNumber(r.payoutPct, `${path}.payoutPct`) ??
      DEFAULT_REQUESTS.payoutPct,
    kindWeights,
    minRarityWeights:
      r.minRarityWeights === undefined
        ? { ...DEFAULT_REQUESTS.minRarityWeights }
        : rarityWeights(r.minRarityWeights, `${path}.minRarityWeights`),
  };
}

function normalizeTrader(raw: unknown): TraderConfig {
  const path = "shops.trader";
  const row = requireRecord(raw, path);
  const nums = requireNumberFields(
    row,
    ["itemCount", "minItemLevelOffset", "maxItemLevelOffset", "priceMulPct"],
    path,
  ) as Pick<
    TraderConfig,
    "itemCount" | "minItemLevelOffset" | "maxItemLevelOffset" | "priceMulPct"
  >;
  return {
    title: requireString(row.title, `${path}.title`),
    ...nums,
    rerollCost: optionalFiniteNumber(row.rerollCost, `${path}.rerollCost`) ?? 0,
    requestCount:
      optionalFiniteNumber(row.requestCount, `${path}.requestCount`) ?? 0,
    requests: normalizeRequests(row.requests, `${path}.requests`),
    rarityWeights: rarityWeights(row.rarityWeights, `${path}.rarityWeights`),
    consumables: requireArray(row.consumables, `${path}.consumables`).map(
      (c, i) => {
        const p = `${path}.consumables[${i}]`;
        const r = requireRecord(c, p);
        return {
          id: requireString(r.id, `${p}.id`),
          ...(requireNumberFields(r, ["qty", "chancePct"], p) as {
            qty: number;
            chancePct: number;
          }),
        };
      },
    ),
    levels: levels<TraderLevelFields>(
      row,
      path,
      TRADER_NUMBER_FIELDS,
      "rarityWeights",
    ),
  };
}

function normalizeBlacksmith(raw: unknown): BlacksmithConfig {
  const path = "shops.blacksmith";
  const row = requireRecord(raw, path);
  const list = <K extends string>(key: "items" | "consumables", idKey: K) =>
    requireArray(row[key], `${path}.${key}`).map((c, i) => {
      const p = `${path}.${key}[${i}]`;
      const r = requireRecord(c, p);
      return {
        [idKey]: requireString(r[idKey], `${p}.${idKey}`),
        unlockNight: requireFiniteNumber(r.unlockNight, `${p}.unlockNight`),
      } as Record<K, string> & { unlockNight: number };
    });
  const opt = (key: string) =>
    optionalFiniteNumber(row[key], `${path}.${key}`) ?? 0;
  return {
    title: requireString(row.title, `${path}.title`),
    priceMulPct: requireFiniteNumber(row.priceMulPct, `${path}.priceMulPct`),
    stockCount: opt("stockCount"),
    stockItemLevelOffset: opt("stockItemLevelOffset"),
    stockRarityWeights:
      row.stockRarityWeights === undefined
        ? { common: 0, magic: 1, rare: 0, epic: 0, legendary: 0 }
        : rarityWeights(row.stockRarityWeights, `${path}.stockRarityWeights`),
    unlockNightsEarly: opt("unlockNightsEarly"),
    items: list("items", "baseId"),
    consumables: list("consumables", "id"),
    levels: levels<BlacksmithLevelFields>(
      row,
      path,
      BLACKSMITH_NUMBER_FIELDS,
      "stockRarityWeights",
    ),
  };
}

/** Validate `public/data/shops.json` (trader stock rules, blacksmith catalogue, upgrade levels). */
export function normalizeShops(raw: unknown): ShopsConfig {
  const root = requireRecord(raw, "shops");
  return {
    trader: normalizeTrader(root.trader),
    blacksmith: normalizeBlacksmith(root.blacksmith),
  };
}
