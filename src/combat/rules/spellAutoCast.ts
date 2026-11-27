import { spellById, type SpellId } from "../../content/spells";
import { spellRequiresStationary } from "../../content/spellTargeting";

export type SpellAutoCastCandidate = {
  slotIndex: number;
  spellId: SpellId;
};

/**
 * Spell auto-cast priority: top row left→right, then bottom row (indices 0–5).
 * When moving, spells with a cast or channel wind-up are skipped so movement can interrupt them.
 */
export function pickAutoCastSpell(
  slots: SpellId[],
  autoCastSpellIds: readonly SpellId[],
  isMoving: boolean,
  cooldownRemaining: (id: SpellId) => number,
  isChanneling: boolean,
): SpellAutoCastCandidate | null {
  if (isChanneling) return null;
  const auto = new Set(autoCastSpellIds);
  for (let i = 0; i < slots.length; i++) {
    const spellId = slots[i] ?? "";
    if (!spellId || !auto.has(spellId)) continue;
    const def = spellById(spellId);
    if (!def) continue;
    if ((cooldownRemaining(spellId) ?? 0) > 0) continue;
    if (isMoving && spellRequiresStationary(def)) continue;
    return { slotIndex: i, spellId };
  }
  return null;
}
