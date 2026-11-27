import { tuning } from "../tuning/gameTuning";
import type { SpellDefinition } from "./spells";
import { spellById } from "./spells";
import { spellUsesManualGroundAim } from "./spellTargeting";

/** Targeted ground AoE: short spell-bar tap auto-aims at the nearest enemy; press-drag places at release, including empty ground. */
export function spellGroundTapAutoCastsForDef(def: SpellDefinition): boolean {
  return spellUsesManualGroundAim(def);
}

export function deriveGroundTapAutoCastSpellIds(
  spells: readonly SpellDefinition[],
): string[] {
  return spells
    .filter(spellGroundTapAutoCastsForDef)
    .map((s) => s.id)
    .sort((a, b) => a.localeCompare(b));
}

export function spellGroundTapAutoCasts(spellId: string): boolean {
  const def = spellById(spellId);
  if (def) return spellGroundTapAutoCastsForDef(def);
  return tuning("spellInput").groundTapAutoCastSpellIds.includes(spellId);
}
