import type {
  AffixDef,
  EquipSlot,
  GearCatalog,
  ItemInstance,
  ItemType,
  RarityId,
  RolledAffix,
} from "./gearTypes";
import { RARITY_IDS } from "./gearTypes";
import { pickWeighted, randInt, type Rng } from "./rng";

/** An item before it is added to an inventory (no uid yet). */
export type ItemDraft = Omit<ItemInstance, "uid">;

export type RarityWeights = Partial<Record<RarityId, number>>;

/** Max affixes of each position on one item. */
const MAX_PER_POSITION = 2;

/** Bases this many levels under the roll level drop with reduced weight. */
const OUTDATED_BASE_LEVELS = 5;
const OUTDATED_BASE_WEIGHT = 0.35;

export function equipSlotsForType(type: ItemType): EquipSlot[] {
  if (type === "ring") return ["ring1", "ring2"];
  if (type === "trinket") return ["trinket1", "trinket2"];
  return [type];
}

/** Highest affix tier unlocked at `itemLevel`, or undefined when none is. */
export function affixTierFor(
  affix: AffixDef,
  itemLevel: number,
): AffixDef["tiers"][number] | undefined {
  let best: AffixDef["tiers"][number] | undefined;
  for (const tier of affix.tiers) {
    if (tier.minItemLevel <= itemLevel) best = tier;
  }
  return best;
}

function eligibleUniques(
  catalog: GearCatalog,
  itemLevel: number,
  types: readonly ItemType[] | undefined,
) {
  return Object.values(catalog.uniques).filter((u) => {
    if (u.itemLevel > itemLevel) return false;
    const base = catalog.bases[u.baseId];
    return !!base && (!types || types.includes(base.type));
  });
}

/** Pick a rarity allowed at this item level (weights override `items.json` defaults). */
export function rollRarity(
  catalog: GearCatalog,
  rng: Rng,
  itemLevel: number,
  weights?: RarityWeights,
  types?: readonly ItemType[],
): RarityId {
  const hasUnique = eligibleUniques(catalog, itemLevel, types).length > 0;
  const pick = pickWeighted(rng, RARITY_IDS, (id) => {
    const def = catalog.rarities[id];
    if (def.minItemLevel > itemLevel) return 0;
    if (def.uniquesOnly && !hasUnique) return 0;
    return weights?.[id] ?? def.weight;
  });
  return pick ?? "common";
}

/** Common copy of a base with no affixes (blacksmith stock). */
export function createBaseItem(
  catalog: GearCatalog,
  baseId: string,
  itemLevel: number,
): ItemDraft {
  const base = catalog.bases[baseId];
  if (!base) throw new Error(`Unknown item base "${baseId}"`);
  return {
    baseId,
    rarity: "common",
    itemLevel: Math.max(itemLevel, base.minItemLevel),
    affixes: [],
  };
}

export function createUniqueItem(
  catalog: GearCatalog,
  uniqueId: string,
): ItemDraft {
  const unique = catalog.uniques[uniqueId];
  if (!unique) throw new Error(`Unknown unique item "${uniqueId}"`);
  return {
    baseId: unique.baseId,
    rarity: "legendary",
    itemLevel: unique.itemLevel,
    uniqueId,
    affixes: [],
  };
}

function rollAffixes(
  catalog: GearCatalog,
  rng: Rng,
  type: ItemType,
  itemLevel: number,
  count: number,
): RolledAffix[] {
  const pool = Object.values(catalog.affixes).filter(
    (a) => a.types.includes(type) && affixTierFor(a, itemLevel),
  );
  const out: RolledAffix[] = [];
  const used = new Set<string>();
  const perPosition = { prefix: 0, suffix: 0 };
  for (let i = 0; i < count; i++) {
    const affix = pickWeighted(rng, pool, (a) =>
      used.has(a.id) || perPosition[a.position] >= MAX_PER_POSITION
        ? 0
        : a.weight,
    );
    if (!affix) break;
    used.add(affix.id);
    perPosition[affix.position] += 1;
    const tier = affixTierFor(affix, itemLevel)!;
    const rolled: RolledAffix = {
      id: affix.id,
      value: randInt(rng, tier.min, tier.max),
    };
    if ("spells" in affix.effect) {
      const spells = affix.effect.spells;
      rolled.spell = spells[randInt(rng, 0, spells.length - 1)]!;
    }
    out.push(rolled);
  }
  return out;
}

export type RollItemOptions = {
  itemLevel: number;
  rarity?: RarityId;
  rarityWeights?: RarityWeights;
  /** Limit to these item types (default: any). */
  types?: readonly ItemType[];
};

/** Random item at `itemLevel`: rarity, base and affixes from the catalog. */
export function rollItem(
  catalog: GearCatalog,
  rng: Rng,
  opts: RollItemOptions,
): ItemDraft | null {
  const itemLevel = Math.max(1, Math.floor(opts.itemLevel));
  const rarity =
    opts.rarity ??
    rollRarity(catalog, rng, itemLevel, opts.rarityWeights, opts.types);
  const rarityDef = catalog.rarities[rarity];
  if (rarityDef.uniquesOnly) {
    const unique = pickWeighted(
      rng,
      eligibleUniques(catalog, itemLevel, opts.types),
      () => 1,
    );
    if (unique) return createUniqueItem(catalog, unique.id);
    return rollItem(catalog, rng, { ...opts, rarity: "epic" });
  }
  const base = pickWeighted(rng, Object.values(catalog.bases), (b) => {
    if (b.minItemLevel > itemLevel) return 0;
    if (opts.types && !opts.types.includes(b.type)) return 0;
    return itemLevel - b.minItemLevel >= OUTDATED_BASE_LEVELS
      ? OUTDATED_BASE_WEIGHT
      : 1;
  });
  if (!base) return null;
  const count = randInt(rng, rarityDef.minAffixes, rarityDef.maxAffixes);
  const affixes = rollAffixes(catalog, rng, base.type, itemLevel, count);
  return {
    baseId: base.id,
    rarity: affixes.length === 0 && count > 0 ? "common" : rarity,
    itemLevel,
    affixes,
  };
}
