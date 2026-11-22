import { SPELL_BAR } from "../config";
import type { SpellId } from "./spells";

/** Copy bar slots to fixed length with empty trailing slots. */
export function normalizeBarSlots(
  slots: readonly SpellId[],
  slotCount = SPELL_BAR.slotCount,
): SpellId[] {
  const next = slots.slice(0, slotCount);
  while (next.length < slotCount) next.push("");
  return next;
}

/**
 * Tap-toggle in town spell sort: add to the first empty slot, or clear the slot holding this id.
 * Slot order matches defense `SPELL_BAR` grid (index 0 = top-left).
 */
export function toggleSpellOnDefenseBar(
  slots: readonly SpellId[],
  spellId: SpellId,
  slotCount = SPELL_BAR.slotCount,
): SpellId[] {
  if (!spellId) return normalizeBarSlots(slots, slotCount);
  const next = normalizeBarSlots(slots, slotCount);
  const existingAt = next.indexOf(spellId);
  if (existingAt >= 0) {
    next[existingAt] = "";
    return next;
  }
  const empty = next.indexOf("");
  if (empty < 0) return next;
  next[empty] = spellId;
  return next;
}

export function isSpellOnDefenseBar(
  slots: readonly SpellId[],
  spellId: SpellId,
): boolean {
  return spellId !== "" && slots.includes(spellId);
}

/** Empty every defense spell bar slot (town sort + defense grid share slot count). */
export function clearAllDefenseBarSlots(
  slotCount = SPELL_BAR.slotCount,
): SpellId[] {
  return Array.from({ length: slotCount }, () => "");
}