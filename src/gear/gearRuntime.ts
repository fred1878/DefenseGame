import type { DamageFlavor } from "../combat/DamageSystem";
import { applyEffectivePlayerTuning, basePlayerTuning } from "../config/player";
import { getGearCatalog } from "./gearCatalog";
import type { GearCatalog, OnHitProc, SaveGear } from "./gearTypes";
import {
  armourReduction,
  effectivePlayerTuning,
  emptyGearStats,
  gearStatsFor,
  type GearStats,
} from "./itemStats";

/** Combat-time view of the equipped gear (set by `applyGearLoadout`). */
type GearRuntime = {
  stats: GearStats;
  damageTakenMult: number;
};

let runtime: GearRuntime = { stats: emptyGearStats(), damageTakenMult: 1 };
/** Fractional lifesteal carried between hits so small heals still add up. */
let lifestealCarry = 0;

/**
 * Apply equipped gear: player tuning (weapons, attack speed, HP, move speed)
 * plus the combat hooks below. Call when a run starts and after equipment changes.
 */
export function applyGearLoadout(
  gear: SaveGear,
  catalog: GearCatalog = getGearCatalog(),
): GearStats {
  const stats = gearStatsFor(catalog, gear);
  applyEffectivePlayerTuning(effectivePlayerTuning(basePlayerTuning(), stats));
  runtime = {
    stats,
    damageTakenMult: 1 - armourReduction(catalog, stats.flat.armour),
  };
  lifestealCarry = 0;
  return stats;
}

/** Incoming damage multiplier from armour (1 = no reduction). */
export function gearDamageTakenMult(): number {
  return runtime.damageTakenMult;
}

/** Spell power × element bonus × named-spell bonus for one spell. */
export function gearSpellDamageMult(def?: {
  id: string;
  damageFlavor?: DamageFlavor | undefined;
}): number {
  const s = runtime.stats;
  let mult = 1 + s.flat.spellPowerPct / 100;
  if (def?.damageFlavor) {
    mult *= 1 + (s.elementDamagePct[def.damageFlavor] ?? 0) / 100;
  }
  if (def) mult *= 1 + (s.spellDamagePct[def.id] ?? 0) / 100;
  return Math.max(0, mult);
}

/** Cooldown multiplier for a spell (0.8 = 20% shorter). */
export function gearSpellCooldownMul(spellId: string): number {
  return Math.max(0, 1 - (runtime.stats.spellCooldownPct[spellId] ?? 0) / 100);
}

export function gearWeaponProcs(): readonly OnHitProc[] {
  return runtime.stats.procs;
}

/** Ranged weapon shot sprite (texture key + optional tint), or null for the default stone. */
export function gearRangedProjectile(): {
  textureKey: string;
  tint: number | undefined;
} | null {
  const r = runtime.stats.ranged;
  return r ? { textureKey: r.projectile, tint: r.projectileTint } : null;
}

/** Whole HP to heal from a weapon hit of `damage`, keeping the fraction for later hits. */
export function takeLifestealHeal(damage: number): number {
  const pct = runtime.stats.flat.lifestealPct;
  if (pct <= 0 || damage <= 0) return 0;
  lifestealCarry += (damage * pct) / 100;
  const whole = Math.floor(lifestealCarry);
  lifestealCarry -= whole;
  return whole;
}
