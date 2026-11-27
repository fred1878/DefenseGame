import { SPELL_BAR } from "../config/spellBar";
import type { DamageFlavor } from "../combat/DamageSystem";
import type { SpellTargetMode } from "./spellTargeting";
import bundledSpells from "../../public/data/spells.json";

export type SpellId = string;

export type SpellOnHitEffects = {
  slowPct?: number;
  slowMs?: number;
  dotDps?: number;
  dotMs?: number;
  rootMs?: number;
  stunMs?: number;
};

export type SpellMechanicType =
  | "projectile"
  | "projectile_aoe"
  | "tracking_projectile"
  | "swing"
  | "tracking_swing"
  | "cone"
  | "channeled_cone"
  | "blast"
  | "channeled"
  | "channeled_area"
  | "ice_wall"
  | "buff"
  | "blink"
  | "instant_targeted"
  | "heal";

export type SpellDefinition = {
  id: SpellId;
  name: string;
  shortLabel: string;
  mechanicType: SpellMechanicType;
  castableInDefense: boolean;
  implementationPhase: number;
  cooldownMs: number;
  /** Windup before channel or instant resolution (MobileRPG startupDuration). */
  castMs?: number;
  channelMs: number;
  channelTickMs?: number;
  targetMode?: SpellTargetMode;
  requireEnemyTarget?: boolean;
  centerOnCaster?: boolean;
  groundTargetMaxRangeWu?: number;
  burstDamage?: number;
  lingerMs?: number;
  lingerTickMs?: number;
  coneRangeWu?: number;
  coneArcDeg?: number;
  swingRangeWu?: number;
  swingArcDeg?: number;
  /** Display size (px, both axes) of the swing slash sprite. */
  swingFxSizePx?: number;
  chainLightningHops?: number;
  chainLightningHopRangeWu?: number;
  blinkDistanceWu?: number;
  /** Binary-search steps when sliding a partial blink away from blockers. */
  blinkResolveBinarySearchIterations?: number;
  /** Minimum travel (WU) to treat partial blink as having moved. */
  blinkPartialMoveEpsilonWu?: number;
  iceWallDistanceWu?: number;
  iceWallDurationMs?: number;
  shadowformDurationMs?: number;
  shadowformMoveSpeedMult?: number;
  shadowformDamageTakenMult?: number;
  shadowformAggroRadiusMult?: number;
  onHit?: SpellOnHitEffects;
  baseDamage?: number;
  projectileSpeedWu?: number;
  blastRadiusWu?: number;
  /** Direct-hit knockback (projectile, cone, swing, instant targeted primary). */
  knockbackWu?: number;
  /** Blast-radius knockback (blast mechanic, AoE detonation, secondary bursts). Zero disables. */
  blastKnockbackWu?: number;
  /** Chain lightning first-target knockback. */
  chainKnockbackWu?: number;
  /** Chain lightning hop knockback. */
  chainHopKnockbackWu?: number;
  healAmount?: number;
  /** Splash damage = primary damage × this, for instant_targeted rows with blastRadiusWu. */
  burstBlastDamageScale?: number;
  iconFile: string;
  projectileTextureKey?: string;
  projectileFile?: string;
  blastTextureKey?: string;
  blastFile?: string;
  damageFlavor?: DamageFlavor;
};

type SpellsJson = { spells: SpellDefinition[] };

let activeCatalog: SpellDefinition[] = (bundledSpells as SpellsJson).spells;

export function setSpellCatalog(rows: readonly SpellDefinition[]): void {
  activeCatalog = [...rows];
}

export function getSpellCatalog(): readonly SpellDefinition[] {
  return activeCatalog;
}

export function createDefaultSpellBarSlots(): SpellId[] {
  const castable = getSpellCatalog()
    .filter((s) => s.castableInDefense)
    .map((s) => s.id);
  const slots: SpellId[] = castable.slice(0, SPELL_BAR.slotCount);
  while (slots.length < SPELL_BAR.slotCount) slots.push("");
  return slots;
}

type NumericSpellField = {
  [K in keyof SpellDefinition]-?: NonNullable<SpellDefinition[K]> extends number
    ? K
    : never;
}[keyof SpellDefinition];

/**
 * A numeric spell field that boot validation (`normalizeSpellCatalog`) requires
 * for this row's mechanic. Throws, naming `spells.json`, instead of falling back
 * to a hidden code default.
 */
export function requireSpellNumber(
  def: SpellDefinition,
  field: NumericSpellField,
): number {
  const v = def[field];
  if (typeof v !== "number") {
    throw new Error(`spells.json: spell ${def.id} is missing ${field}`);
  }
  return v;
}

export function spellById(id: SpellId): SpellDefinition | undefined {
  if (!id) return undefined;
  return getSpellCatalog().find((s) => s.id === id);
}
