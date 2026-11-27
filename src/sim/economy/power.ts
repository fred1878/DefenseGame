import { basePlayerTuning } from "../../config/player";
import { pickAutoCastSpell } from "../../combat/rules/spellAutoCast";
import { autoCastOrder } from "./spellBars";
import {
  createDefaultSpellBarSlots,
  spellById,
  type SpellDefinition,
  type SpellId,
} from "../../content/spells";
import { spellCastMs } from "../../content/spellTargeting";
import { applyGearLoadout, gearSpellDamageMult } from "../../gear/gearRuntime";
import type { GearCatalog, SaveGear, StatBonus } from "../../gear/gearTypes";
import {
  armourReduction,
  effectivePlayerTuning,
  type GearStats,
} from "../../gear/itemStats";
import type { NightDifficulty } from "./simData";

/**
 * Knobs for the power model (all exposed on the CLI). The model is
 * crowd-aware: area attacks (melee arcs, AoE spells, bombs) hit more enemies
 * the more are alive at once, and killing a wave fast cuts the damage it
 * deals. The defaults are fitted to real headless fights (`npm run
 * sim:fights -- fit`, docs/ECONOMY_SIM.md).
 */
export type PowerModel = {
  /**
   * Share of the fight the player stands still, when auto-cast runs the
   * whole bar in slot order (cast-windup spells included).
   */
  castStillShare: number;
  /**
   * Share of the fight the player moves, when auto-cast skips spells with a
   * cast windup or channel and only instant spells fire.
   */
  castMovingShare: number;
  /**
   * Share of single-target weapon DPS that lands over a fight (walking
   * between targets, knockback, kiting), melee and ranged.
   */
  meleeUptime: number;
  rangedUptime: number;
  /**
   * Share of the crowd-area extra targets a melee swing actually hits
   * (knockback scatters packs; 0 = always one target).
   */
  weaponCrowd: number;
  /** Seconds after the last spawn the player gets to finish the wave. */
  graceSec: number;
  /** Fraction of each enemy's hit (player and wall) assumed to land per night. */
  threatScale: number;
  /** Win-chance steepness: chance = r^k / (1 + r^k), so r = 1 is 50%. */
  steepness: number;
  /** Exponents of the offence / defence / wall ratios in the power ratio. */
  offenceWeight: number;
  defenceWeight: number;
  wallWeight: number;
  /**
   * Area (world units²) the living enemies are spread over around the
   * player. An attack covering area A hits 1 + (alive − 1) × min(1, A / this)
   * enemies.
   */
  crowdAreaWu2: number;
  /**
   * How incoming damage scales with kill time: enemy hits × (kill time ÷
   * fight time)^this. 0 = the old flat threat; higher = fast killers take
   * much less damage.
   */
  exposure: number;
  /** Share of lifesteal healing over the fight that counts as extra EHP. */
  lifestealUptime: number;
  /** Damage taken removed per unit of slow / stun uptime on hit enemies (crowd control). */
  crowdControl: number;
};

export const DEFAULT_POWER_MODEL: PowerModel = {
  castStillShare: 0.1,
  castMovingShare: 0.5,
  meleeUptime: 0.65,
  rangedUptime: 0.3,
  weaponCrowd: 0,
  graceSec: 45,
  threatScale: 0.35,
  steepness: 2,
  offenceWeight: 0,
  defenceWeight: 0.9,
  wallWeight: 0.1,
  crowdAreaWu2: 640000,
  exposure: 0.5,
  lifestealUptime: 1,
  crowdControl: 0.3,
};

/** One damaging spell on the bar, as the game's auto-cast rotation uses it. */
export type SpellPower = {
  id: string;
  /** Single-target DPS (incl. its burn) while standing still. */
  stillDps: number;
  /** Single-target DPS while moving (0 for cast-windup / channel spells). */
  movingDps: number;
  /** Area each cast covers (0 = single target). */
  areaWu2: number;
  /** Gear / talent multiplier (spell power, element, named-spell boosts). */
  mult: number;
};

/** Single-target DPS of one bar spell at the model's still / moving shares. */
export const spellDpsFor = (s: SpellPower, model: PowerModel) =>
  s.mult *
  (model.castStillShare * s.stillDps + model.castMovingShare * s.movingDps);

export type PlayerPower = {
  meleeDps: number;
  rangedDps: number;
  /** Expected extra DPS from damage-over-time procs on weapon hits (per target hit). */
  procDps: number;
  /** Single-target weapon DPS of the better mode, procs included. */
  weaponDps: number;
  /** Melee is the better single-target mode (the fight bot picks the same). */
  meleeBest: boolean;
  /** Area of the melee swing (arc × reach²) in world units². */
  meleeAreaWu2: number;
  /** Expected share of time a hit enemy is slowed or stunned by weapon procs. */
  ccUptime: number;
  /** Average gear multiplier on the default spell bar's damaging spells. */
  spellMult: number;
  spells: SpellPower[];
  /** Single-target spell DPS at the model's uptimes. */
  spellDps: number;
  /** weaponDps + spellDps (single target, no crowd). */
  offenceDps: number;
  maxHp: number;
  armour: number;
  /** Fraction of damage removed by armour (0..max). */
  damageReduction: number;
  /** maxHp / (1 − reduction). */
  ehp: number;
  attackSpeedPct: number;
  spellPowerPct: number;
  lifestealPct: number;
};

function cycleSec(windupMs: number, activeMs: number, recoveryMs: number) {
  return Math.max(0.05, (windupMs + activeMs + recoveryMs) / 1000);
}

function expectedProcs(stats: GearStats, hitsPerSec: number) {
  let dps = 0;
  let cc = 0;
  for (const p of stats.procs) {
    const perSec = (p.chancePct / 100) * hitsPerSec;
    if (p.kind === "dot") dps += perSec * p.dps * (p.ms / 1000);
    else if (p.kind === "slow")
      cc += perSec * (p.ms / 1000) * (p.slowPct / 100);
    else cc += perSec * (p.ms / 1000);
  }
  return { dps, cc: Math.min(1, cc) };
}

const sector = (arcDeg: number, rangeWu: number) =>
  (Math.min(360, Math.max(0, arcDeg)) / 360) * Math.PI * rangeWu ** 2;

/** Area one cast of `def` covers (0 = single target). */
export function spellAreaWu2(def: SpellDefinition): number {
  switch (def.mechanicType) {
    case "cone":
    case "channeled_cone":
      return sector(def.coneArcDeg ?? 0, def.coneRangeWu ?? 0);
    case "swing":
    case "tracking_swing":
      return sector(def.swingArcDeg ?? 0, def.swingRangeWu ?? 0);
    case "tracking_projectile":
      return def.chainLightningHops
        ? Math.PI * (def.chainLightningHopRangeWu ?? 0) ** 2
        : 0;
    default:
      return def.blastRadiusWu ? Math.PI * def.blastRadiusWu ** 2 : 0;
  }
}

/** Damage of one cast of `def` on one target (hit + burst + full burn). */
export function spellCastDamage(def: SpellDefinition): number {
  return (
    (def.baseDamage ?? 0) +
    (def.burstDamage ?? 0) +
    ((def.onHit?.dotDps ?? 0) * (def.onHit?.dotMs ?? 0)) / 1000
  );
}

const ROTATION_MS = 60_000;
/** Re-check step for the next auto-cast (the game re-checks every frame). */
const CAST_GAP_MS = 50;
const rateCache = new Map<
  string,
  { defs: unknown[]; rates: Map<SpellId, number> }
>();

/**
 * Casts per second of each bar spell over a minute of auto-cast (the
 * game's own slot-priority pick), standing still or moving.
 */
export function autoCastRates(
  slots: readonly SpellId[],
  cooldownPct: number,
  moving: boolean,
): Map<SpellId, number> {
  // Memoised: the sim asks for the same bar every night (the spell
  // catalog's def objects are part of the key, so swapping it recomputes).
  const key = `${slots.join(",")}|${cooldownPct}|${moving}`;
  const defs = slots.map((id) => spellById(id));
  const hit = rateCache.get(key);
  if (hit?.defs.every((d, i) => d === defs[i])) return hit.rates;
  const ready = new Map<SpellId, number>();
  const casts = new Map<SpellId, number>();
  for (let t = 0; t < ROTATION_MS; ) {
    const pick = pickAutoCastSpell(
      [...slots],
      slots,
      moving,
      (id) => Math.max(0, (ready.get(id) ?? 0) - t),
      false,
    );
    if (!pick) {
      t += CAST_GAP_MS;
      continue;
    }
    const def = spellById(pick.spellId)!;
    casts.set(pick.spellId, (casts.get(pick.spellId) ?? 0) + 1);
    ready.set(pick.spellId, t + def.cooldownMs * (1 - cooldownPct / 100));
    t += Math.max(CAST_GAP_MS, spellCastMs(def) + def.channelMs);
  }
  const rates = new Map<SpellId, number>();
  for (const [id, n] of casts) rates.set(id, n / (ROTATION_MS / 1000));
  rateCache.set(key, { defs, rates });
  return rates;
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
  const procs = expectedProcs(
    stats,
    1 / (meleeBest ? meleeCycle : rangedCycle),
  );
  const weaponDps = Math.max(meleeDps, rangedDps) + procs.dps;
  // Global cooldown reduction casts the bar proportionally more often.
  const cdCap = catalog.statCaps.spellCooldownPct ?? 100;
  const cdPct = Math.min(cdCap, Math.max(0, stats.flat.cooldownPct));
  const bar = autoCastOrder(createDefaultSpellBarSlots());
  const still = autoCastRates(bar, cdPct, false);
  const move = autoCastRates(bar, cdPct, true);
  const spells: SpellPower[] = [];
  for (const id of bar) {
    const def = spellById(id);
    const dmg = def ? spellCastDamage(def) : 0;
    if (!def || dmg <= 0) continue;
    spells.push({
      id: def.id,
      stillDps: dmg * (still.get(id) ?? 0),
      movingDps: dmg * (move.get(id) ?? 0),
      areaWu2: spellAreaWu2(def),
      mult: gearSpellDamageMult(def),
    });
  }
  const spellMult = spells.length
    ? spells.reduce((a, s) => a + s.mult, 0) / spells.length
    : 1;
  const spellDps = spells.reduce((a, s) => a + spellDpsFor(s, model), 0);
  const damageReduction = armourReduction(catalog, stats.flat.armour);
  return {
    meleeDps,
    rangedDps,
    procDps: procs.dps,
    weaponDps,
    meleeBest,
    meleeAreaWu2: sector(t.meleeArcDeg, t.meleeStrikeRangeWu),
    ccUptime: procs.cc,
    spellMult,
    spells,
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
  /** Crowd-adjusted DPS (weapon + procs + spells + bombs). */
  effectiveDps: number;
  /** Average enemies alive at once (from kill time vs spawn window). */
  alive: number;
  /** Enemies a melee swing hits on average (1 for ranged). */
  weaponTargets: number;
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

/** Area a bomb blast covers (fire bomb radius 90). */
const BOMB_AREA_WU2 = Math.PI * 90 ** 2;

/** Enemies an attack covering `areaWu2` hits with `alive` enemies around. */
export function crowdTargets(
  alive: number,
  areaWu2: number,
  model: PowerModel,
): number {
  if (areaWu2 <= 0 || alive <= 1) return 1;
  return 1 + (alive - 1) * Math.min(1, areaWu2 / model.crowdAreaWu2);
}

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
  const count = Math.max(1, night.enemyCount);
  const weaponHit =
    power.weaponDps *
    (power.meleeBest ? model.meleeUptime : model.rangedUptime);
  const dpsAt = (alive: number) => {
    const wt = power.meleeBest
      ? 1 +
        model.weaponCrowd * (crowdTargets(alive, power.meleeAreaWu2, model) - 1)
      : 1;
    let spells = 0;
    for (const s of power.spells) {
      spells += spellDpsFor(s, model) * crowdTargets(alive, s.areaWu2, model);
    }
    const bombs =
      (boost.bombDamage * crowdTargets(alive, BOMB_AREA_WU2, model)) / fightSec;
    return {
      wt,
      dps: weaponHit * wt + spells + bombs,
    };
  };
  // Fixed point: more enemies alive → area attacks hit more → faster kills
  // → fewer alive. Kill time vs spawn window gives the share alive at once.
  let alive = count;
  let cur = dpsAt(alive);
  for (let i = 0; i < 6; i++) {
    const killSec = night.totalHp / Math.max(1e-6, cur.dps);
    alive = Math.max(1, (count * killSec) / (night.spawnSpanSec + killSec));
    cur = dpsAt(alive);
  }
  const killSec = night.totalHp / Math.max(1e-6, cur.dps);
  // Enemies that die fast hit less often: scale incoming damage by kill time.
  const exposure = (killSec / fightSec) ** model.exposure;
  const cc = Math.max(0, 1 - model.crowdControl * power.ccUptime);
  // Lifesteal heals a share of weapon damage dealt (all targets) over the fight.
  const sustain =
    (power.lifestealPct / 100) *
    weaponHit *
    cur.wt *
    Math.min(killSec, fightSec) *
    model.lifestealUptime;
  const ehp = power.ehp + boost.healHp + sustain;
  const ratio = (have: number, need: number) => (need > 0 ? have / need : 10);
  const offenceRatio = ratio(cur.dps, requiredDps);
  const defenceRatio = ratio(
    ehp,
    night.totalDamage * model.threatScale * exposure * cc,
  );
  const wallRatio = ratio(
    wallHpMax,
    night.totalWallDamage * model.threatScale * exposure,
  );
  const powerRatio =
    offenceRatio ** model.offenceWeight *
    defenceRatio ** model.defenceWeight *
    wallRatio ** model.wallWeight;
  return {
    requiredDps,
    effectiveDps: cur.dps,
    alive,
    weaponTargets: cur.wt,
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
