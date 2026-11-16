import type { SpellDefinition } from "./spells";

export type SpellTargetMode = "none" | "self" | "enemy" | "ground";

export function spellTargetMode(def: SpellDefinition): SpellTargetMode {
  if (def.targetMode) return def.targetMode;
  switch (def.mechanicType) {
    case "heal":
    case "buff":
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