import type { SpellDefinition, SpellId } from "./spells";

/** Highest `implementationPhase` wired for defense combat (pool + bar). */
export const SHIPPED_DEFENSE_SPELL_PHASE = 4;

const POOL_READY_ALPHA = 1;
const POOL_ON_BAR_ALPHA = 0.5;
const POOL_COMING_SOON_ALPHA = 0.48;

/**
 * Spells that can be dragged from the town pool onto the night bar.
 * Phase-5 catalog rows may remain `castableInDefense` for data parity but are not pool-ready yet.
 */
export function isSpellPoolSelectable(def: SpellDefinition): boolean {
  return (
    def.castableInDefense &&
    def.implementationPhase <= SHIPPED_DEFENSE_SPELL_PHASE
  );
}

export function poolSpellIconAlpha(
  spellId: SpellId,
  barSlots: readonly SpellId[],
  poolSelectable: boolean,
): number {
  if (!poolSelectable) return POOL_COMING_SOON_ALPHA;
  if (barSlots.includes(spellId)) return POOL_ON_BAR_ALPHA;
  return POOL_READY_ALPHA;
}
