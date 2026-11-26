import type { DamageFlavor } from "../combat/DamageSystem";

/** Player equipment slots (11). Rings and trinkets have two slots each. */
export const EQUIP_SLOTS = [
  "meleeWeapon",
  "rangedWeapon",
  "helm",
  "chest",
  "hands",
  "legs",
  "boots",
  "ring1",
  "ring2",
  "trinket1",
  "trinket2",
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

/** Item base type; `ring` / `trinket` fit either of their two slots. */
export const ITEM_TYPES = [
  "meleeWeapon",
  "rangedWeapon",
  "helm",
  "chest",
  "hands",
  "legs",
  "boots",
  "ring",
  "trinket",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const RARITY_IDS = [
  "common",
  "magic",
  "rare",
  "epic",
  "legendary",
] as const;
export type RarityId = (typeof RARITY_IDS)[number];

/** Plain numeric stats summed across equipped items. */
export const FLAT_STAT_IDS = [
  "meleeDamage",
  "rangedDamage",
  "damagePct",
  "attackSpeedPct",
  "maxHp",
  "armour",
  "moveSpeedPct",
  "spellPowerPct",
  "lifestealPct",
] as const;
export type FlatStatId = (typeof FLAT_STAT_IDS)[number];

export type StatModifier =
  | { stat: FlatStatId; value: number }
  | { stat: "elementDamagePct"; element: DamageFlavor; value: number }
  | {
      stat: "spellDamagePct" | "spellCooldownPct";
      spell: string;
      value: number;
    };

/** On-hit effect from weapon hits (melee swing or ranged shot). */
export type OnHitProc =
  | {
      kind: "dot";
      flavor: DamageFlavor;
      chancePct: number;
      dps: number;
      ms: number;
    }
  | { kind: "slow"; chancePct: number; slowPct: number; ms: number }
  | { kind: "stun"; chancePct: number; ms: number };

export type MeleeWeaponProfile = {
  style: string;
  damage: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  rangeWu: number;
  arcDeg: number;
  knockbackWu: number;
};

export type RangedWeaponProfile = {
  style: string;
  damage: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  rangeWu: number;
  projectileSpeedWu: number;
  knockbackWu: number;
  /** `COMBAT_FX_TEXTURE` key for the shot sprite. */
  projectile: string;
  /** Optional sprite tint (0xRRGGBB). */
  projectileTint?: number;
};

export type ItemBase = {
  id: string;
  name: string;
  type: ItemType;
  minItemLevel: number;
  price: number;
  modifiers: StatModifier[];
  melee?: MeleeWeaponProfile;
  ranged?: RangedWeaponProfile;
};

export type AffixTier = { minItemLevel: number; min: number; max: number };

/** Template for what an affix adds; the rolled value fills `value` (or the proc's power). */
export type AffixEffect =
  | { stat: FlatStatId }
  | { stat: "elementDamagePct"; element: DamageFlavor }
  | { stat: "spellDamagePct" | "spellCooldownPct"; spells: string[] }
  | { proc: "dot"; flavor: DamageFlavor; chancePct: number; ms: number }
  | { proc: "slow"; chancePct: number; ms: number }
  | { proc: "stun"; chancePct: number };

export type AffixDef = {
  id: string;
  label: string;
  position: "prefix" | "suffix";
  types: ItemType[];
  weight: number;
  tiers: AffixTier[];
  effect: AffixEffect;
};

export type RarityDef = {
  id: RarityId;
  label: string;
  color: string;
  minAffixes: number;
  maxAffixes: number;
  priceMul: number;
  minItemLevel: number;
  weight: number;
  /** When true, this rarity only rolls authored uniques. */
  uniquesOnly: boolean;
};

export type UniqueDef = {
  id: string;
  name: string;
  baseId: string;
  itemLevel: number;
  price: number;
  modifiers: StatModifier[];
  procs: OnHitProc[];
  /** Short flavour line shown in the item detail. */
  note: string;
};

export type GearCatalog = {
  armourHalfReductionAt: number;
  armourMaxReductionPct: number;
  itemLevelPriceStepPct: number;
  statCaps: Partial<Record<FlatStatId | "spellCooldownPct", number>>;
  rarities: Record<RarityId, RarityDef>;
  bases: Record<string, ItemBase>;
  affixes: Record<string, AffixDef>;
  uniques: Record<string, UniqueDef>;
};

/** One rolled affix stored on an item. `spell` is set for spell-keyed affixes. */
export type RolledAffix = { id: string; value: number; spell?: string };

/** Owned item as stored in the save; stats are resolved from the catalog at runtime. */
export type ItemInstance = {
  uid: number;
  baseId: string;
  rarity: RarityId;
  itemLevel: number;
  uniqueId?: string;
  affixes: RolledAffix[];
};

export type SaveGear = {
  items: ItemInstance[];
  equipped: Partial<Record<EquipSlot, number>>;
  nextUid: number;
};
