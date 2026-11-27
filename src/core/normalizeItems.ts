import {
  DAMAGE_FLAVORS,
  type DamageFlavor,
} from "../combat/rules/DamageSystem";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import {
  FLAT_STAT_IDS,
  ITEM_TYPES,
  RARITY_IDS,
  type AffixDef,
  type AffixEffect,
  type AffixTier,
  type FlatStatId,
  type GearCatalog,
  type ItemBase,
  type ItemType,
  type MeleeWeaponProfile,
  type OnHitProc,
  type RangedWeaponProfile,
  type RarityDef,
  type RarityId,
  type StatModifier,
  type UniqueDef,
} from "../gear/gearTypes";
import {
  ConfigLoadError,
  requireFiniteNumber,
  requireNumberFields,
  requireRecord,
} from "./configValidation";

export const ITEMS_FILE_BOOT_KEYS = [
  "armour",
  "halfReductionAt",
  "maxReductionPct",
  "itemLevelPriceStepPct",
  "statCaps",
  "rarities",
  "bases",
  "affixes",
  "uniques",
] as const;
export const ITEMS_RARITY_BOOT_KEYS = [
  "label",
  "color",
  "minAffixes",
  "maxAffixes",
  "priceMul",
  "minItemLevel",
  "weight",
  "uniquesOnly",
] as const;
export const ITEMS_BASE_BOOT_KEYS = [
  "name",
  "type",
  "price",
  "modifiers",
  "melee",
  "ranged",
] as const;
export const ITEMS_MELEE_BOOT_KEYS = [
  "damage",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "rangeWu",
  "arcDeg",
  "knockbackWu",
] as const;
export const ITEMS_RANGED_BOOT_KEYS = [
  "damage",
  "windupMs",
  "activeMs",
  "recoveryMs",
  "rangeWu",
  "projectileSpeedWu",
  "knockbackWu",
] as const;
export const ITEMS_WEAPON_EXTRA_KEYS = [
  "style",
  "projectile",
  "projectileTint",
] as const;
export const ITEMS_AFFIX_BOOT_KEYS = [
  "position",
  "types",
  "effect",
  "tiers",
  "min",
  "max",
  "proc",
  "spells",
] as const;
export const ITEMS_UNIQUE_BOOT_KEYS = [
  "baseId",
  "itemLevel",
  "procs",
  "note",
] as const;
export const ITEMS_MODIFIER_BOOT_KEYS = [
  "stat",
  "value",
  "element",
  "spell",
  "kind",
  "flavor",
  "chancePct",
  "dps",
  "ms",
  "slowPct",
] as const;

export function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigLoadError(`Missing or invalid string at ${path}`);
  }
  return value;
}

export function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ConfigLoadError(`Missing or invalid array at ${path}`);
  }
  return value;
}

export function requireOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ConfigLoadError(
      `Invalid value at ${path} (expected one of ${allowed.join(", ")})`,
    );
  }
  return value as T;
}

export function requireFlavor(value: unknown, path: string): DamageFlavor {
  return requireOneOf(value, DAMAGE_FLAVORS, path);
}

/** Parse `#rrggbb` to 0xRRGGBB. */
export function parseHexColor(value: unknown, path: string): number {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new ConfigLoadError(`Expected #rrggbb colour at ${path}`);
  }
  return Number.parseInt(value.slice(1), 16);
}

export function normalizeStatModifier(
  raw: unknown,
  path: string,
): StatModifier {
  const row = requireRecord(raw, path);
  const value = requireFiniteNumber(row.value, `${path}.value`);
  const stat = row.stat;
  if (stat === "elementDamagePct") {
    return {
      stat,
      element: requireFlavor(row.element, `${path}.element`),
      value,
    };
  }
  if (stat === "spellDamagePct" || stat === "spellCooldownPct") {
    return { stat, spell: requireString(row.spell, `${path}.spell`), value };
  }
  return {
    stat: requireOneOf<FlatStatId>(stat, FLAT_STAT_IDS, `${path}.stat`),
    value,
  };
}

export function normalizeOnHitProc(raw: unknown, path: string): OnHitProc {
  const row = requireRecord(raw, path);
  const chancePct = requireFiniteNumber(row.chancePct, `${path}.chancePct`);
  const kind = requireOneOf(row.kind, ["dot", "slow", "stun"], `${path}.kind`);
  if (kind === "dot") {
    return {
      kind,
      flavor: requireFlavor(row.flavor, `${path}.flavor`),
      chancePct,
      dps: requireFiniteNumber(row.dps, `${path}.dps`),
      ms: requireFiniteNumber(row.ms, `${path}.ms`),
    };
  }
  if (kind === "slow") {
    return {
      kind,
      chancePct,
      slowPct: requireFiniteNumber(row.slowPct, `${path}.slowPct`),
      ms: requireFiniteNumber(row.ms, `${path}.ms`),
    };
  }
  return { kind, chancePct, ms: requireFiniteNumber(row.ms, `${path}.ms`) };
}

function normalizeModifierList(raw: unknown, path: string): StatModifier[] {
  if (raw === undefined) return [];
  return requireArray(raw, path).map((m, i) =>
    normalizeStatModifier(m, `${path}[${i}]`),
  );
}

function normalizeRarity(id: RarityId, raw: unknown): RarityDef {
  const path = `items.rarities.${id}`;
  const row = requireRecord(raw, path);
  const nums = requireNumberFields(
    row,
    ["minAffixes", "maxAffixes", "priceMul", "minItemLevel", "weight"],
    path,
  ) as Record<
    "minAffixes" | "maxAffixes" | "priceMul" | "minItemLevel" | "weight",
    number
  >;
  if (nums.maxAffixes < nums.minAffixes) {
    throw new ConfigLoadError(`${path}.maxAffixes must be >= minAffixes`);
  }
  parseHexColor(row.color, `${path}.color`);
  return {
    id,
    label: requireString(row.label, `${path}.label`),
    color: row.color as string,
    ...nums,
    uniquesOnly: row.uniquesOnly === true,
  };
}

function normalizeMelee(raw: unknown, path: string): MeleeWeaponProfile {
  const row = requireRecord(raw, path);
  const nums = requireNumberFields(row, ITEMS_MELEE_BOOT_KEYS, path) as Record<
    (typeof ITEMS_MELEE_BOOT_KEYS)[number],
    number
  >;
  return { style: requireString(row.style, `${path}.style`), ...nums };
}

function normalizeRanged(raw: unknown, path: string): RangedWeaponProfile {
  const row = requireRecord(raw, path);
  const nums = requireNumberFields(row, ITEMS_RANGED_BOOT_KEYS, path) as Record<
    (typeof ITEMS_RANGED_BOOT_KEYS)[number],
    number
  >;
  const projectileKey = requireOneOf(
    row.projectile,
    Object.keys(COMBAT_FX_TEXTURE) as (keyof typeof COMBAT_FX_TEXTURE)[],
    `${path}.projectile`,
  );
  const out: RangedWeaponProfile = {
    style: requireString(row.style, `${path}.style`),
    ...nums,
    projectile: COMBAT_FX_TEXTURE[projectileKey],
  };
  if (row.projectileTint !== undefined) {
    out.projectileTint = parseHexColor(
      row.projectileTint,
      `${path}.projectileTint`,
    );
  }
  return out;
}

function normalizeBase(id: string, raw: unknown): ItemBase {
  const path = `items.bases.${id}`;
  const row = requireRecord(raw, path);
  const type = requireOneOf<ItemType>(row.type, ITEM_TYPES, `${path}.type`);
  const base: ItemBase = {
    id,
    name: requireString(row.name, `${path}.name`),
    type,
    minItemLevel: requireFiniteNumber(row.minItemLevel, `${path}.minItemLevel`),
    price: requireFiniteNumber(row.price, `${path}.price`),
    modifiers: normalizeModifierList(row.modifiers, `${path}.modifiers`),
  };
  if (type === "meleeWeapon") {
    base.melee = normalizeMelee(row.melee, `${path}.melee`);
  } else if (type === "rangedWeapon") {
    base.ranged = normalizeRanged(row.ranged, `${path}.ranged`);
  }
  return base;
}

function normalizeAffixEffect(raw: unknown, path: string): AffixEffect {
  const row = requireRecord(raw, path);
  if (row.proc !== undefined) {
    const proc = requireOneOf(
      row.proc,
      ["dot", "slow", "stun"],
      `${path}.proc`,
    );
    const chancePct = requireFiniteNumber(row.chancePct, `${path}.chancePct`);
    if (proc === "dot") {
      return {
        proc,
        flavor: requireFlavor(row.flavor, `${path}.flavor`),
        chancePct,
        ms: requireFiniteNumber(row.ms, `${path}.ms`),
      };
    }
    if (proc === "slow") {
      return { proc, chancePct, ms: requireFiniteNumber(row.ms, `${path}.ms`) };
    }
    return { proc, chancePct };
  }
  if (row.stat === "elementDamagePct") {
    return {
      stat: row.stat,
      element: requireFlavor(row.element, `${path}.element`),
    };
  }
  if (row.stat === "spellDamagePct" || row.stat === "spellCooldownPct") {
    const spells = requireArray(row.spells, `${path}.spells`).map((s, i) =>
      requireString(s, `${path}.spells[${i}]`),
    );
    if (spells.length === 0) {
      throw new ConfigLoadError(`${path}.spells must not be empty`);
    }
    return { stat: row.stat, spells };
  }
  return {
    stat: requireOneOf<FlatStatId>(row.stat, FLAT_STAT_IDS, `${path}.stat`),
  };
}

function normalizeAffix(id: string, raw: unknown): AffixDef {
  const path = `items.affixes.${id}`;
  const row = requireRecord(raw, path);
  const tiers: AffixTier[] = requireArray(row.tiers, `${path}.tiers`).map(
    (t, i) =>
      requireNumberFields(
        requireRecord(t, `${path}.tiers[${i}]`),
        ["minItemLevel", "min", "max"],
        `${path}.tiers[${i}]`,
      ) as AffixTier,
  );
  if (tiers.length === 0) {
    throw new ConfigLoadError(`${path}.tiers must not be empty`);
  }
  tiers.sort((a, b) => a.minItemLevel - b.minItemLevel);
  return {
    id,
    label: requireString(row.label, `${path}.label`),
    position: requireOneOf(
      row.position,
      ["prefix", "suffix"],
      `${path}.position`,
    ),
    types: requireArray(row.types, `${path}.types`).map((t, i) =>
      requireOneOf<ItemType>(t, ITEM_TYPES, `${path}.types[${i}]`),
    ),
    weight: requireFiniteNumber(row.weight, `${path}.weight`),
    tiers,
    effect: normalizeAffixEffect(row.effect, `${path}.effect`),
  };
}

function normalizeUnique(
  id: string,
  raw: unknown,
  bases: Record<string, ItemBase>,
): UniqueDef {
  const path = `items.uniques.${id}`;
  const row = requireRecord(raw, path);
  const baseId = requireString(row.baseId, `${path}.baseId`);
  if (!bases[baseId]) {
    throw new ConfigLoadError(`${path}.baseId: unknown base "${baseId}"`);
  }
  return {
    id,
    name: requireString(row.name, `${path}.name`),
    baseId,
    itemLevel: requireFiniteNumber(row.itemLevel, `${path}.itemLevel`),
    price: requireFiniteNumber(row.price, `${path}.price`),
    modifiers: normalizeModifierList(row.modifiers, `${path}.modifiers`),
    procs: requireArray(row.procs, `${path}.procs`).map((p, i) =>
      normalizeOnHitProc(p, `${path}.procs[${i}]`),
    ),
    note: typeof row.note === "string" ? row.note : "",
  };
}

function mapRecord<T>(
  raw: unknown,
  path: string,
  fn: (id: string, value: unknown) => T,
): Record<string, T> {
  const rec = requireRecord(raw, path);
  return Object.fromEntries(
    Object.entries(rec).map(([id, value]) => [id, fn(id, value)]),
  );
}

/** Validate `public/data/items.json` into a `GearCatalog`. */
export function normalizeItems(raw: unknown): GearCatalog {
  const root = requireRecord(raw, "items");
  const armour = requireRecord(root.armour, "items.armour");
  const capsRaw = requireRecord(root.statCaps, "items.statCaps");
  const statCaps: GearCatalog["statCaps"] = {};
  for (const [key, value] of Object.entries(capsRaw)) {
    const stat = requireOneOf(
      key,
      [...FLAT_STAT_IDS, "spellCooldownPct" as const],
      "items.statCaps",
    );
    statCaps[stat] = requireFiniteNumber(value, `items.statCaps.${key}`);
  }
  const raritiesRaw = requireRecord(root.rarities, "items.rarities");
  const rarities = Object.fromEntries(
    RARITY_IDS.map((id) => [id, normalizeRarity(id, raritiesRaw[id])]),
  ) as Record<RarityId, RarityDef>;
  const bases = mapRecord(root.bases, "items.bases", normalizeBase);
  const affixes = mapRecord(root.affixes, "items.affixes", normalizeAffix);
  const uniques = mapRecord(root.uniques, "items.uniques", (id, v) =>
    normalizeUnique(id, v, bases),
  );
  return {
    armourHalfReductionAt: requireFiniteNumber(
      armour.halfReductionAt,
      "items.armour.halfReductionAt",
    ),
    armourMaxReductionPct: requireFiniteNumber(
      armour.maxReductionPct,
      "items.armour.maxReductionPct",
    ),
    itemLevelPriceStepPct: requireFiniteNumber(
      root.itemLevelPriceStepPct,
      "items.itemLevelPriceStepPct",
    ),
    statCaps,
    rarities,
    bases,
    affixes,
    uniques,
  };
}
