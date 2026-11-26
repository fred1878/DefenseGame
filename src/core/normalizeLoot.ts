import { RARITY_IDS, type RarityId } from "../gear/gearTypes";
import type { LootConfig, LootTable } from "../gear/loot";
import {
  ConfigLoadError,
  requireFiniteNumber,
  requireNumberFields,
  requireRecord,
} from "./configValidation";

export const LOOT_FILE_BOOT_KEYS = [
  "inventoryCapacity",
  "sellBackPct",
  "tables",
] as const;
export const LOOT_TABLE_BOOT_KEYS = [
  "minRolls",
  "maxRolls",
  "minItemLevelOffset",
  "maxItemLevelOffset",
  "rarityByLevel",
  "fromLevel",
  "weights",
] as const;

function normalizeTable(id: string, raw: unknown): LootTable {
  const path = `loot.tables.${id}`;
  const row = requireRecord(raw, path);
  const nums = requireNumberFields(
    row,
    ["minRolls", "maxRolls", "minItemLevelOffset", "maxItemLevelOffset"],
    path,
  ) as Omit<LootTable, "rarityByLevel">;
  if (nums.maxRolls < nums.minRolls) {
    throw new ConfigLoadError(`${path}.maxRolls must be >= minRolls`);
  }
  if (!Array.isArray(row.rarityByLevel) || row.rarityByLevel.length === 0) {
    throw new ConfigLoadError(
      `Missing or empty array at ${path}.rarityByLevel`,
    );
  }
  const rarityByLevel = row.rarityByLevel.map((band, i) => {
    const b = requireRecord(band, `${path}.rarityByLevel[${i}]`);
    const w = requireRecord(b.weights, `${path}.rarityByLevel[${i}].weights`);
    const weights: Partial<Record<RarityId, number>> = {};
    for (const [rarity, value] of Object.entries(w)) {
      if (!RARITY_IDS.includes(rarity as RarityId)) {
        throw new ConfigLoadError(
          `Unknown rarity "${rarity}" at ${path}.rarityByLevel[${i}].weights`,
        );
      }
      weights[rarity as RarityId] = requireFiniteNumber(
        value,
        `${path}.rarityByLevel[${i}].weights.${rarity}`,
      );
    }
    return {
      fromLevel: requireFiniteNumber(
        b.fromLevel,
        `${path}.rarityByLevel[${i}].fromLevel`,
      ),
      weights,
    };
  });
  rarityByLevel.sort((a, b) => a.fromLevel - b.fromLevel);
  return { ...nums, rarityByLevel };
}

/** Validate `public/data/loot.json` (bag size, sell-back rate, drop tables). */
export function normalizeLoot(raw: unknown): LootConfig {
  const root = requireRecord(raw, "loot");
  const tables = requireRecord(root.tables, "loot.tables");
  return {
    inventoryCapacity: requireFiniteNumber(
      root.inventoryCapacity,
      "loot.inventoryCapacity",
    ),
    sellBackPct: requireFiniteNumber(root.sellBackPct, "loot.sellBackPct"),
    tables: Object.fromEntries(
      Object.entries(tables).map(([id, t]) => [id, normalizeTable(id, t)]),
    ),
  };
}
