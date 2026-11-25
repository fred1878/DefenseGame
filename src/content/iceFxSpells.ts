import type { SpellDefinition } from "./spells";

/** Frost spells that show Ice VFX 2 Start on the caster during cast windup. */
export function spellUsesIceCastWindupFx(def: SpellDefinition): boolean {
  return def.damageFlavor === "frost" && (def.castMs ?? 0) > 0;
}

export const ICE_BOLT_SPELL_ID = "ice_bolt" as const;
