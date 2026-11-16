import { spellById, type SpellId } from "../content/spells";
import { spellCastMs } from "../content/spellTargeting";

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
  autoCast: readonly boolean[],
  isMoving: boolean,
  cooldownRemaining: (id: SpellId) => number,
  isChanneling: boolean,
): SpellAutoCastCandidate | null {
  if (isChanneling) return null;
  const n = Math.min(slots.length, autoCast.length);
  for (let i = 0; i < n; i++) {
    if (!autoCast[i]) continue;
    const spellId = slots[i] ?? "";
    if (!spellId) continue;
    const def = spellById(spellId);
    if (!def) continue;
    if ((cooldownRemaining(spellId) ?? 0) > 0) continue;
    if (isMoving && (spellCastMs(def) > 0 || def.channelMs > 0)) continue;
    return { slotIndex: i, spellId };
  }
  return null;
}