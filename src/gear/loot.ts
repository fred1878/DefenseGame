import bundledLoot from "../../public/data/loot.json";
import { normalizeLoot } from "../core/normalizeLoot";
import type { SaveGame } from "../core/saveTypes";
import { addItem, bagItems } from "./inventory";
import { rollItem, type ItemDraft, type RarityWeights } from "./itemGen";
import { resolveItem, sellValue } from "./itemStats";
import type { GearCatalog, RarityId } from "./gearTypes";
import { randInt, type Rng } from "./rng";

export type LootTable = {
  minRolls: number;
  maxRolls: number;
  minItemLevelOffset: number;
  maxItemLevelOffset: number;
  rarityByLevel: {
    fromLevel: number;
    weights: Partial<Record<RarityId, number>>;
  }[];
};

export type LootConfig = {
  inventoryCapacity: number;
  sellBackPct: number;
  /** Percent of a night's rewardGold paid when the night is lost. */
  lostNightGoldPct: number;
  tables: Record<string, LootTable>;
};

let activeLoot: LootConfig | null = null;

export function setLootConfig(config: LootConfig): void {
  activeLoot = config;
}

/** Active loot config; falls back to the bundled `loot.json` before Boot. */
export function getLootConfig(): LootConfig {
  if (!activeLoot) activeLoot = normalizeLoot(bundledLoot);
  return activeLoot;
}

/** Rarity weights of the highest band at or below `level`. */
export function rarityWeightsAt(
  table: LootTable,
  level: number,
): RarityWeights {
  let weights = table.rarityByLevel[0]!.weights;
  for (const band of table.rarityByLevel) {
    if (band.fromLevel <= level) weights = band.weights;
  }
  // Rarities missing from the band never roll.
  return {
    common: 0,
    magic: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    ...weights,
  };
}

/**
 * Roll a loot table at `level` (night number today; adventure areas later).
 * Returns item drafts; add them with `addLootToSave`.
 */
export function rollLoot(
  catalog: GearCatalog,
  table: LootTable,
  level: number,
  rng: Rng,
): ItemDraft[] {
  const out: ItemDraft[] = [];
  const rolls = randInt(rng, table.minRolls, table.maxRolls);
  for (let i = 0; i < rolls; i++) {
    const itemLevel = Math.max(
      1,
      level + randInt(rng, table.minItemLevelOffset, table.maxItemLevelOffset),
    );
    const item = rollItem(catalog, rng, {
      itemLevel,
      rarityWeights: rarityWeightsAt(table, itemLevel),
    });
    if (item) out.push(item);
  }
  return out;
}

export type LootAddResult = {
  save: SaveGame;
  /** Drafts that did not fit in the bag and were sold. */
  soldGold: number;
  soldCount: number;
};

/** Add drops to the bag; items beyond `inventoryCapacity` are sold at the sell-back rate. */
export function addLootToSave(
  save: SaveGame,
  drops: readonly ItemDraft[],
  catalog: GearCatalog,
  loot: LootConfig = getLootConfig(),
): LootAddResult {
  let gear = save.gear;
  let soldGold = 0;
  let soldCount = 0;
  for (const draft of drops) {
    if (bagItems(gear).length >= loot.inventoryCapacity) {
      const r = resolveItem(catalog, { ...draft, uid: 0 });
      soldGold += r ? sellValue(r.price, loot.sellBackPct) : 0;
      soldCount += 1;
      continue;
    }
    gear = addItem(gear, draft).gear;
  }
  return {
    save: { ...save, gear, gold: save.gold + soldGold },
    soldGold,
    soldCount,
  };
}

/** Gear dropped at the end of a campaign night (`nightWon` / `nightLost` tables). */
export function rollNightDrops(
  catalog: GearCatalog,
  won: boolean,
  night: number,
  rng: Rng,
  loot: LootConfig = getLootConfig(),
): ItemDraft[] {
  const table = loot.tables[won ? "nightWon" : "nightLost"];
  if (!table) return [];
  return rollLoot(catalog, table, night, rng);
}
