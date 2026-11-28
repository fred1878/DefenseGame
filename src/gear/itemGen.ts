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

export function equipSlotsForType(type: ItemType): EquipSlot[] {
  if (type === "ring") return ["ring1", "ring2"];
  if (type === "trinket") return ["trinket1", "trinket2"];
  return [type];
}

/**
 * Highest affix tier unlocked at `itemLevel`, or undefined when none is.
 * Compares `minItemLevel` rather than relying on the tiers being stored in
 * ascending order, so a tier inserted out of order still resolves correctly.
 */
export function affixTierFor(
  affix: AffixDef,
  itemLevel: number,
): AffixDef["tiers"][number] | undefined {
  let best: AffixDef["tiers"][number] | undefined;
  for (const tier of affix.tiers) {
    if (tier.minItemLevel > itemLevel) continue;
    if (!best || tier.minItemLevel > best.minItemLevel) best = tier;
  }
  return best;
}

/** Uniques of `rarity` whose roll level is reached and whose base fits `types`. */
function eligibleUniques(
  catalog: GearCatalog,
  itemLevel: number,
  rarity: RarityId,
  types: readonly ItemType[] | undefined,
) {
  return Object.values(catalog.uniques).filter((u) => {
    if (u.rarity !== rarity) return false;
    if (u.itemLevel > itemLevel) return false;
    const base = catalog.bases[u.baseId];
    return !!base && (!types || types.includes(base.type));
  });
}

/** Percent chance a roll of `rarity` is an authored unique (0 for common). */
export function uniqueChanceFor(
  catalog: GearCatalog,
  rarity: RarityId,
): number {
  return rarity === "common" ? 0 : catalog.uniqueChanceByRarity[rarity];
}

/** Pick a rarity allowed at this item level (weights override `items.json` defaults). */
export function rollRarity(
  catalog: GearCatalog,
  rng: Rng,
  itemLevel: number,
  weights?: RarityWeights,
  types?: readonly ItemType[],
): RarityId {
  const pick = pickWeighted(rng, RARITY_IDS, (id) => {
    const def = catalog.rarities[id];
    if (def.minItemLevel > itemLevel) return 0;
    // A guaranteed-unique rarity needs a unique that fits, or it cannot roll.
    if (
      uniqueChanceFor(catalog, id) >= 100 &&
      eligibleUniques(catalog, itemLevel, id, types).length === 0
    ) {
      return 0;
    }
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

/** Authored unique at `itemLevel` (defaults to, and never below, its own level). */
export function createUniqueItem(
  catalog: GearCatalog,
  uniqueId: string,
  itemLevel?: number,
): ItemDraft {
  const unique = catalog.uniques[uniqueId];
  if (!unique) throw new Error(`Unknown unique item "${uniqueId}"`);
  return {
    baseId: unique.baseId,
    rarity: unique.rarity,
    itemLevel: Math.max(itemLevel ?? unique.itemLevel, unique.itemLevel),
    uniqueId,
    affixes: [],
  };
}

/**
 * Pick weight for a base `levelsStale` item levels under the roll level: 1
 * until `outdatedBaseStartLevels`, `outdatedBaseStartWeight` at that level,
 * tapering linearly to 0 at `outdatedBaseEndLevels` (and never above).
 */
export function basePickWeight(
  generation: GearCatalog["generation"],
  levelsStale: number,
): number {
  const start = generation.outdatedBaseStartLevels;
  const end = generation.outdatedBaseEndLevels;
  if (levelsStale < start) return 1;
  if (levelsStale >= end) return 0;
  const span = Math.max(1, end - start);
  return (
    generation.outdatedBaseStartWeight * (1 - (levelsStale - start) / span)
  );
}

/** Highest rarity below `from` that never rolls a unique and fits `itemLevel`. */
function normalRarityBelow(
  catalog: GearCatalog,
  from: RarityId,
  itemLevel: number,
): RarityId {
  for (let i = RARITY_IDS.indexOf(from) - 1; i > 0; i--) {
    const id = RARITY_IDS[i]!;
    const def = catalog.rarities[id];
    if (uniqueChanceFor(catalog, id) < 100 && def.minItemLevel <= itemLevel) {
      return id;
    }
  }
  return "common";
}

/** The unique a roll of `rarity` lands on, or null when it stays a normal item. */
function rollUniqueFor(
  catalog: GearCatalog,
  rng: Rng,
  rarity: RarityId,
  itemLevel: number,
  types: readonly ItemType[] | undefined,
) {
  const chance = uniqueChanceFor(catalog, rarity);
  if (chance <= 0) return null;
  if (chance < 100 && rng() * 100 >= chance) return null;
  return (
    pickWeighted(
      rng,
      eligibleUniques(catalog, itemLevel, rarity, types),
      () => 1,
    ) ?? null
  );
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
      used.has(a.id) ||
      perPosition[a.position] >= catalog.generation.maxAffixesPerPosition
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
  /** Force this rarity; its unique chance still applies. */
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
  const unique = rollUniqueFor(catalog, rng, rarity, itemLevel, opts.types);
  if (unique) return createUniqueItem(catalog, unique.id, itemLevel);
  // A unique-only rarity with nothing to give becomes the best normal rarity below.
  const rolledRarity =
    uniqueChanceFor(catalog, rarity) >= 100
      ? normalRarityBelow(catalog, rarity, itemLevel)
      : rarity;
  const rarityDef = catalog.rarities[rolledRarity];
  const base = pickWeighted(rng, Object.values(catalog.bases), (b) => {
    if (b.minItemLevel > itemLevel) return 0;
    if (opts.types && !opts.types.includes(b.type)) return 0;
    return basePickWeight(catalog.generation, itemLevel - b.minItemLevel);
  });
  if (!base) return null;
  const count = randInt(rng, rarityDef.minAffixes, rarityDef.maxAffixes);
  const affixes = rollAffixes(catalog, rng, base.type, itemLevel, count);
  return {
    baseId: base.id,
    rarity: affixes.length === 0 && count > 0 ? "common" : rolledRarity,
    itemLevel,
    affixes,
  };
}
