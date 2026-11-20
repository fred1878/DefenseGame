import type { SpellDefinition } from "./spells";

export type SpellTargetMode = "none" | "self" | "enemy" | "ground";

export function spellTargetMode(def: SpellDefinition): SpellTargetMode {
  if (def.targetMode) return def.targetMode;
  switch (def.mechanicType) {
    case "heal":
    case "buff":
    case "blink":
      return "self";
    case "instant_targeted":
    case "tracking_projectile":
    case "tracking_swing":
      return "enemy";
    case "channeled_area":
      return "ground";
    case "blast":
      return def.centerOnCaster ? "none" : "ground";
    case "channeled":
      return def.centerOnCaster === false ? "ground" : "none";
    default:
      return "none";
  }
}

export function spellRequiresManualTarget(def: SpellDefinition): boolean {
  const mode = spellTargetMode(def);
  return mode === "ground" || (mode === "enemy" && def.requireEnemyTarget === true);
}

export function spellChannelTickMs(def: SpellDefinition): number {
  return def.channelTickMs ?? 250;
}

export function spellCastMs(def: SpellDefinition): number {
  return def.castMs ?? 0;
}

/** Channeled or cast-windup spells need the player still to start (movement interrupt). */
export function spellRequiresStationary(def: SpellDefinition): boolean {
  return spellCastMs(def) > 0 || def.channelMs > 0;
}

/** Stick magnitude above this counts as moving for spell queue / auto-cast. */
export const SPELL_MOVE_INTERRUPT_EPS = 0.12;

/** Spells that auto-cast should resolve an enemy target for (manual rules unchanged). */
export function spellAutoCastNeedsEnemyTarget(def: SpellDefinition): boolean {
  if (spellTargetMode(def) === "enemy") return true;
  switch (def.mechanicType) {
    case "cone":
    case "swing":
    case "tracking_swing":
      return true;
    default:
      return false;
  }
}

/**
 * Auto-cast waits for a living combat target before firing (manual cast unchanged).
 * Self-centered buffs/heals and caster-centered novas may still auto-cast with no enemies.
 */
export function spellAutoCastRequiresCombatTarget(def: SpellDefinition): boolean {
  const mode = spellTargetMode(def);
  if (mode === "ground" || mode === "enemy") return true;
  if (spellAutoCastNeedsEnemyTarget(def)) return true;
  return def.mechanicType === "projectile" || def.mechanicType === "projectile_aoe";
}

/** Bolt-style projectiles always pick/auto-aim using ranged reach, not melee strike band. */
export function spellAutoCastUsesRangedEnemyPick(def: SpellDefinition): boolean {
  return def.mechanicType === "projectile" || def.mechanicType === "projectile_aoe";
}

/** Spells that fire in the player's facing direction toward a combat target. */
export function spellCastUsesEnemyAim(def: SpellDefinition): boolean {
  switch (def.mechanicType) {
    case "projectile":
    case "projectile_aoe":
    case "cone":
    case "swing":
    case "tracking_swing":
      return true;
    default:
      return false;
  }
}