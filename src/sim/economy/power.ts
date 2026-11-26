import { basePlayerTuning } from "../../config/player";
import { createDefaultSpellBarSlots, spellById } from "../../content/spells";
import { applyGearLoadout, gearSpellDamageMult } from "../../gear/gearRuntime";
import type { GearCatalog, SaveGear, StatBonus } from "../../gear/gearTypes";
import {
  armourReduction,
  effectivePlayerTuning,
  type GearStats,
} from "../../gear/itemStats";
import type { NightDifficulty } from "./simData";

/** Knobs for the power model (all exposed on the CLI). */
export type PowerModel = {
  /** Spell DPS of the default spell bar with no gear (spell power multiplies it). */
  spellBaseDps: number;
  /** Seconds after the last spawn the player gets to finish the wave. */
  graceSec: number;
  /** Fraction of each enemy's hit (player and wall) assumed to land per night. */
  threatScale: number;
  /** Win-chance steepness: chance = r^k / (1 + r^k), so r = 1 is 50%. */
  steepness: number;
  /**
   * Exponents of the offence / defence / wall ratios in the power ratio
   * (sum 1). Calibrated against real combat runs (docs/ECONOMY_SIM.md,
   * "Validating the win model").
   */
  offenceWeight: number;
  defenceWeight: number;
  wallWeight: number;
  /** Enemies a bomb is assumed to hit. */
  bombTargets: number;
  /** Share of lifesteal healing over the fight that counts as extra EHP. */
  lifestealUptime: number;
};

export const DEFAULT_POWER_MODEL: PowerModel = {
  spellBaseDps: 12,
  graceSec: 20,
  threatScale: 0.5,
  steepness: 4,
  offenceWeight: 0.2,
  defenceWeight: 0.6,
  wallWeight: 0.2,
  bombTargets: 3,
  lifestealUptime: 0.25,
};

export type PlayerPower = {
  meleeDps: number;
  rangedDps: number;
  /** Expected extra DPS from damage-over-time procs on weapon hits. */
  procDps: number;
  weaponDps: number;
  /** Average gear multiplier on the default spell bar's damaging spells. */
  spellMult: number;
  spellDps: number;
  /** weaponDps + spellDps (+ bombs when used). */
  offenceDps: number;
  maxHp: number;
  armour: number;
  /** Fraction of damage removed by armour (0..max). */
  damageReduction: number;
  /** maxHp / (1 − reduction) (+ potion healing when used). */
  ehp: number;
  attackSpeedPct: number;
  spellPowerPct: number;
  lifestealPct: number;
};

function cycleSec(windupMs: number, activeMs: number, recoveryMs: number) {
  return Math.max(0.05, (windupMs + activeMs + recoveryMs) / 1000);
}

function expectedProcDps(stats: GearStats, hitsPerSec: number): number {
  let dps = 0;
  for (const p of stats.procs) {
    if (p.kind === "dot") {
      dps += (p.chancePct / 100) * hitsPerSec * p.dps * (p.ms / 1000);
    }
  }
  return dps;
}

/**
 * Player combat power with `gear` equipped (plus `bonus`, e.g. learned
 * talents), using the game's own stat code.
 */
export function playerPower(
  catalog: GearCatalog,
  gear: SaveGear,
  model: PowerModel = DEFAULT_POWER_MODEL,
  bonus?: StatBonus,
): PlayerPower {
  const stats = applyGearLoadout(gear, catalog, bonus);
  const t = effectivePlayerTuning(basePlayerTuning(), stats);
  const meleeCycle = cycleSec(
    t.meleeWindupMs,
    t.meleeActiveMs,
    t.meleeRecoveryMs,
  );
  const rangedCycle = cycleSec(
    t.rangedWindupMs,
    t.rangedActiveMs,
    t.rangedRecoveryMs,
  );
  const meleeDps = t.meleeDamage / meleeCycle;
  const rangedDps = t.rangedDamage / rangedCycle;
  const meleeBest = meleeDps >= rangedDps;
  const procDps = expectedProcDps(
    stats,
    1 / (meleeBest ? meleeCycle : rangedCycle),
  );
  const weaponDps = Math.max(meleeDps, rangedDps) + procDps;
  const spellMults = createDefaultSpellBarSlots()
    .map((id) => spellById(id))
    .filter((def) => !!def && (def.baseDamage ?? 0) > 0)
    .map((def) => gearSpellDamageMult(def));
  const spellMult = spellMults.length
    ? spellMults.reduce((a, b) => a + b, 0) / spellMults.length
    : 1;
  // Global cooldown reduction casts the bar proportionally more often.
  const cdCap = catalog.statCaps.spellCooldownPct ?? 100;
  const cdPct = Math.min(cdCap, Math.max(0, stats.flat.cooldownPct));
  const spellDps = (model.spellBaseDps * spellMult) / (1 - cdPct / 100);
  const damageReduction = armourReduction(catalog, stats.flat.armour);
  return {
    meleeDps,
    rangedDps,
    procDps,
    weaponDps,
    spellMult,
    spellDps,
    offenceDps: weaponDps + spellDps,
    maxHp: t.maxHp,
    armour: stats.flat.armour,
    damageReduction,
    ehp: t.maxHp / (1 - damageReduction),
    attackSpeedPct: stats.flat.attackSpeedPct,
    spellPowerPct: stats.flat.spellPowerPct,
    lifestealPct: stats.flat.lifestealPct,
  };
}

export type NightPressure = {
  /** DPS needed to kill every enemy within the spawn span + grace. */
  requiredDps: number;
  offenceRatio: number;
  defenceRatio: number;
  wallRatio: number;
  /** offence^wo × defence^wd × wall^ww (model weights; 1 = even fight). */
  powerRatio: number;
  winChance: number;
};

/** Extra power from consumables spent on a night. */
export type ConsumableBoost = { healHp: number; bombDamage: number };

const NO_BOOST: ConsumableBoost = { healHp: 0, bombDamage: 0 };

/** Compare player power and wall HP to a night's enemy totals. */
export function nightPressure(
  power: PlayerPower,
  night: NightDifficulty,
  wallHpMax: number,
  model: PowerModel = DEFAULT_POWER_MODEL,
  boost: ConsumableBoost = NO_BOOST,
): NightPressure {
  const fightSec = night.spawnSpanSec + model.graceSec;
  const requiredDps = night.totalHp / fightSec;
  const offence =
    power.offenceDps + (boost.bombDamage * model.bombTargets) / fightSec;
  // Lifesteal heals a share of weapon damage dealt over the fight.
  const sustain =
    (power.lifestealPct / 100) *
    power.weaponDps *
    fightSec *
    model.lifestealUptime;
  const ehp = power.ehp + boost.healHp + sustain;
  const ratio = (have: number, need: number) => (need > 0 ? have / need : 10);
  const offenceRatio = ratio(offence, requiredDps);
  const defenceRatio = ratio(ehp, night.totalDamage * model.threatScale);
  const wallRatio = ratio(wallHpMax, night.totalWallDamage * model.threatScale);
  const powerRatio =
    offenceRatio ** model.offenceWeight *
    defenceRatio ** model.defenceWeight *
    wallRatio ** model.wallWeight;
  return {
    requiredDps,
    offenceRatio,
    defenceRatio,
    wallRatio,
    powerRatio,
    winChance: winChance(powerRatio, model.steepness),
  };
}

export function winChance(powerRatio: number, steepness: number): number {
  if (powerRatio <= 0) return 0;
  const x = powerRatio ** steepness;
  return x / (1 + x);
}
