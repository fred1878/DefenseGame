import type { DamageFlavor } from "../combat/DamageSystem";
import type { PlayerTuning } from "../config/player";
import {
  FLAT_STAT_IDS,
  type AffixDef,
  type FlatStatId,
  type GearCatalog,
  type ItemBase,
  type ItemInstance,
  type MeleeWeaponProfile,
  type OnHitProc,
  type RangedWeaponProfile,
  type RarityDef,
  type RolledAffix,
  type SaveGear,
  type StatBonus,
  type StatModifier,
  type UniqueDef,
} from "./gearTypes";

export type ResolvedItem = {
  item: ItemInstance;
  base: ItemBase;
  unique: UniqueDef | undefined;
  rarity: RarityDef;
  name: string;
  modifiers: StatModifier[];
  procs: OnHitProc[];
  price: number;
};

export type GearStats = {
  flat: Record<FlatStatId, number>;
  elementDamagePct: Partial<Record<DamageFlavor, number>>;
  spellDamagePct: Record<string, number>;
  spellCooldownPct: Record<string, number>;
  procs: OnHitProc[];
  melee: MeleeWeaponProfile | null;
  ranged: RangedWeaponProfile | null;
};

function affixContribution(
  def: AffixDef,
  rolled: RolledAffix,
): { modifier?: StatModifier; proc?: OnHitProc } {
  const e = def.effect;
  const value = rolled.value;
  if ("proc" in e) {
    if (e.proc === "dot") {
      return {
        proc: {
          kind: "dot",
          flavor: e.flavor,
          chancePct: e.chancePct,
          dps: value,
          ms: e.ms,
        },
      };
    }
    if (e.proc === "slow") {
      return {
        proc: {
          kind: "slow",
          chancePct: e.chancePct,
          slowPct: value,
          ms: e.ms,
        },
      };
    }
    return { proc: { kind: "stun", chancePct: e.chancePct, ms: value } };
  }
  if (e.stat === "elementDamagePct") {
    return { modifier: { stat: e.stat, element: e.element, value } };
  }
  if (e.stat === "spellDamagePct" || e.stat === "spellCooldownPct") {
    const spell = rolled.spell ?? e.spells[0]!;
    return { modifier: { stat: e.stat, spell, value } };
  }
  return { modifier: { stat: e.stat, value } };
}

export function itemPrice(
  catalog: GearCatalog,
  base: ItemBase,
  rarity: RarityDef,
  itemLevel: number,
  unique?: UniqueDef,
): number {
  if (unique) return unique.price;
  const levels = Math.max(0, itemLevel - base.minItemLevel);
  const step = 1 + (levels * catalog.itemLevelPriceStepPct) / 100;
  return Math.max(1, Math.round(base.price * rarity.priceMul * step));
}

/** Gold returned when selling an item worth `price`. */
export function sellValue(price: number, sellBackPct: number): number {
  return Math.max(0, Math.floor((price * sellBackPct) / 100));
}

/** Resolve stats and display name from the catalog; null when the item no longer exists in data. */
export function resolveItem(
  catalog: GearCatalog,
  item: ItemInstance,
): ResolvedItem | null {
  const base = catalog.bases[item.baseId];
  if (!base) return null;
  const unique = item.uniqueId ? catalog.uniques[item.uniqueId] : undefined;
  if (item.uniqueId && !unique) return null;
  const rarity = catalog.rarities[item.rarity];
  if (!rarity) return null;
  const modifiers = [...base.modifiers, ...(unique?.modifiers ?? [])];
  const procs = [...(unique?.procs ?? [])];
  let prefix: string | undefined;
  let suffix: string | undefined;
  for (const rolled of item.affixes) {
    const def = catalog.affixes[rolled.id];
    if (!def) continue;
    const c = affixContribution(def, rolled);
    if (c.modifier) modifiers.push(c.modifier);
    if (c.proc) procs.push(c.proc);
    if (def.position === "prefix") prefix ??= def.label;
    else suffix ??= def.label;
  }
  const name =
    unique?.name ??
    [prefix, base.name, suffix].filter((s) => s !== undefined).join(" ");
  return {
    item,
    base,
    unique,
    rarity,
    name,
    modifiers,
    procs,
    price: itemPrice(catalog, base, rarity, item.itemLevel, unique),
  };
}

export function emptyGearStats(): GearStats {
  const flat = Object.fromEntries(FLAT_STAT_IDS.map((k) => [k, 0])) as Record<
    FlatStatId,
    number
  >;
  return {
    flat,
    elementDamagePct: {},
    spellDamagePct: {},
    spellCooldownPct: {},
    procs: [],
    melee: null,
    ranged: null,
  };
}

function addModifier(stats: GearStats, m: StatModifier): void {
  if (m.stat === "elementDamagePct") {
    stats.elementDamagePct[m.element] =
      (stats.elementDamagePct[m.element] ?? 0) + m.value;
  } else if (m.stat === "spellDamagePct" || m.stat === "spellCooldownPct") {
    const bucket = stats[m.stat];
    bucket[m.spell] = (bucket[m.spell] ?? 0) + m.value;
  } else {
    stats.flat[m.stat] += m.value;
  }
}

/**
 * Sum the stats of a list of resolved items plus optional extra sources
 * (talents), then apply `statCaps`.
 */
export function sumItemStats(
  catalog: GearCatalog,
  items: readonly ResolvedItem[],
  bonus?: StatBonus,
): GearStats {
  const stats = emptyGearStats();
  for (const r of items) {
    for (const m of r.modifiers) addModifier(stats, m);
    stats.procs.push(...r.procs);
    if (r.base.melee) stats.melee = r.base.melee;
    if (r.base.ranged) stats.ranged = r.base.ranged;
  }
  if (bonus) {
    for (const m of bonus.modifiers) addModifier(stats, m);
    stats.procs.push(...bonus.procs);
  }
  for (const id of FLAT_STAT_IDS) {
    const cap = catalog.statCaps[id];
    if (cap !== undefined) stats.flat[id] = Math.min(cap, stats.flat[id]);
  }
  const cdCap = catalog.statCaps.spellCooldownPct;
  if (cdCap !== undefined) {
    for (const [spell, v] of Object.entries(stats.spellCooldownPct)) {
      stats.spellCooldownPct[spell] = Math.min(cdCap, v);
    }
  }
  return stats;
}

/** Resolved items currently equipped (missing uids / data rows are skipped). */
export function equippedItems(
  catalog: GearCatalog,
  gear: SaveGear,
): ResolvedItem[] {
  const out: ResolvedItem[] = [];
  for (const uid of Object.values(gear.equipped)) {
    const item = gear.items.find((i) => i.uid === uid);
    const resolved = item ? resolveItem(catalog, item) : null;
    if (resolved) out.push(resolved);
  }
  return out;
}

/** Equipped gear stats, plus `bonus` (talents) when given. */
export function gearStatsFor(
  catalog: GearCatalog,
  gear: SaveGear,
  bonus?: StatBonus,
): GearStats {
  return sumItemStats(catalog, equippedItems(catalog, gear), bonus);
}

/** Damage reduction fraction (0..max) from armour: armour / (armour + halfReductionAt). */
export function armourReduction(catalog: GearCatalog, armour: number): number {
  if (armour <= 0) return 0;
  const raw = armour / (armour + catalog.armourHalfReductionAt);
  return Math.min(catalog.armourMaxReductionPct / 100, raw);
}

const MIN_ATTACK_SPEED_MUL = 0.25;
const MIN_MOVE_SPEED_MUL = 0.5;

function scaled(baseValue: number, from: number, to: number): number {
  return from > 0 ? baseValue * (to / from) : to;
}

/**
 * Player tuning with gear applied: weapons replace the melee / ranged base
 * profile, attack speed shortens windup, active and recovery, and flat stats add on.
 */
export function effectivePlayerTuning(
  base: PlayerTuning,
  stats: GearStats,
): PlayerTuning {
  const f = stats.flat;
  const speed = Math.max(MIN_ATTACK_SPEED_MUL, 1 + f.attackSpeedPct / 100);
  const dmgMul = Math.max(0, 1 + f.damagePct / 100);
  const melee = stats.melee;
  const ranged = stats.ranged;

  const meleeWindupMs = (melee?.windupMs ?? base.meleeWindupMs) / speed;
  const meleeActiveMs = (melee?.activeMs ?? base.meleeActiveMs) / speed;
  const meleeStrikeRangeWu = melee?.rangeWu ?? base.meleeStrikeRangeWu;
  const rangedMaxRangeWu =
    (ranged?.rangeWu ?? base.rangedMaxRangeWu) *
    Math.max(0, 1 + f.rangedRangePct / 100);

  const out: PlayerTuning = {
    ...base,
    moveSpeedWu:
      base.moveSpeedWu * Math.max(MIN_MOVE_SPEED_MUL, 1 + f.moveSpeedPct / 100),
    maxHp: Math.max(1, base.maxHp + f.maxHp),
    meleeWindupMs,
    meleeActiveMs,
    meleeRecoveryMs: (melee?.recoveryMs ?? base.meleeRecoveryMs) / speed,
    meleeFxStartMs: scaled(
      base.meleeFxStartMs,
      base.meleeWindupMs,
      meleeWindupMs,
    ),
    meleeStrikeRangeWu,
    meleeArcDeg: Math.min(
      360,
      (melee?.arcDeg ?? base.meleeArcDeg) *
        Math.max(0, 1 + f.meleeArcPct / 100),
    ),
    meleeDamage: Math.max(
      1,
      ((melee?.damage ?? base.meleeDamage) + f.meleeDamage) * dmgMul,
    ),
    meleeKnockbackWu: melee?.knockbackWu ?? base.meleeKnockbackWu,
    rangedWindupMs: (ranged?.windupMs ?? base.rangedWindupMs) / speed,
    rangedActiveMs: (ranged?.activeMs ?? base.rangedActiveMs) / speed,
    rangedRecoveryMs: (ranged?.recoveryMs ?? base.rangedRecoveryMs) / speed,
    rangedDamage: Math.max(
      1,
      ((ranged?.damage ?? base.rangedDamage) + f.rangedDamage) * dmgMul,
    ),
    rangedMaxRangeWu,
    autoAttackRangedRange: scaled(
      base.autoAttackRangedRange,
      base.rangedMaxRangeWu,
      rangedMaxRangeWu,
    ),
    projectileSpeedWu: ranged?.projectileSpeedWu ?? base.projectileSpeedWu,
    rangedKnockbackWu: ranged?.knockbackWu ?? base.rangedKnockbackWu,
    autoAttackMeleeRange:
      base.autoAttackMeleeRange - base.meleeStrikeRangeWu + meleeStrikeRangeWu,
  };
  if (base.meleeFxDurationMs !== undefined) {
    out.meleeFxDurationMs = scaled(
      base.meleeFxDurationMs,
      base.meleeActiveMs,
      meleeActiveMs,
    );
  }
  return out;
}
