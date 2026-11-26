import { RARITY_IDS, type RarityId } from "../gear/gearTypes";
import type {
  BlacksmithConfig,
  ShopsConfig,
  TraderConfig,
} from "../gear/shops";
import {
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
  "consumables",
  "id",
  "qty",
  "chancePct",
] as const;
export const SHOPS_BLACKSMITH_BOOT_KEYS = [
  "items",
  "baseId",
  "unlockNight",
] as const;

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
  const w = requireRecord(row.rarityWeights, `${path}.rarityWeights`);
  const rarityWeights: Partial<Record<RarityId, number>> = {};
  for (const [k, v] of Object.entries(w)) {
    const id = requireOneOf(k, RARITY_IDS, `${path}.rarityWeights`);
    rarityWeights[id] = requireFiniteNumber(v, `${path}.rarityWeights.${k}`);
  }
  return {
    title: requireString(row.title, `${path}.title`),
    ...nums,
    rarityWeights,
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
  return {
    title: requireString(row.title, `${path}.title`),
    priceMulPct: requireFiniteNumber(row.priceMulPct, `${path}.priceMulPct`),
    items: list("items", "baseId"),
    consumables: list("consumables", "id"),
  };
}

/** Validate `public/data/shops.json` (trader stock rules, blacksmith catalogue). */
export function normalizeShops(raw: unknown): ShopsConfig {
  const root = requireRecord(raw, "shops");
  return {
    trader: normalizeTrader(root.trader),
    blacksmith: normalizeBlacksmith(root.blacksmith),
  };
}
