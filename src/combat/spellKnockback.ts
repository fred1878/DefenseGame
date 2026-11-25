import type { SpellDefinition } from "../content/spells";
import { ConfigLoadError, requireFiniteNumber } from "../core/configValidation";

function spellFieldPath(def: SpellDefinition, field: string): string {
  return `spells.${def.id}.${field}`;
}

/** Direct-hit knockback from spell row data (projectile impact, cone, swing, primary instant hit). */
export function spellDirectKnockback(def: SpellDefinition): number {
  return requireFiniteNumber(def.knockbackWu, spellFieldPath(def, "knockback"));
}

/** Blast-radius knockback from spell row data (AoE detonation, blast mechanic). Zero disables push. */
export function spellBlastKnockback(def: SpellDefinition): number {
  return requireFiniteNumber(
    def.blastKnockbackWu,
    spellFieldPath(def, "blastKnockback"),
  );
}

/** Chain lightning first-target knockback from spell row data. */
export function spellChainKnockback(def: SpellDefinition): number {
  return requireFiniteNumber(
    def.chainKnockbackWu,
    spellFieldPath(def, "chainKnockback"),
  );
}

/** Chain lightning hop knockback from spell row data. */
export function spellChainHopKnockback(def: SpellDefinition): number {
  return requireFiniteNumber(
    def.chainHopKnockbackWu,
    spellFieldPath(def, "chainHopKnockback"),
  );
}

/** Spell projectile direct hit must resolve knockback from catalog, never player tuning. */
export function spellProjectileDirectKnockback(
  spellId: string,
  def: SpellDefinition | undefined,
): number {
  if (!def) {
    throw new ConfigLoadError(
      `Unknown spell knockback for projectile spellId=${spellId}`,
    );
  }
  return spellDirectKnockback(def);
}
