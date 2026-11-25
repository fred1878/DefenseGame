import { SPELL_BAR } from "../config";
import { spellById, type SpellId } from "./spells";

export function createDefaultAutoCastSpellIds(): SpellId[] {
  return [];
}

export function dedupeAutoCastSpellIds(ids: readonly SpellId[]): SpellId[] {
  const out: SpellId[] = [];
  const seen = new Set<SpellId>();
  for (const id of ids) {
    if (!id || seen.has(id) || !spellById(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Migrate legacy per-slot flags or normalize an existing id list. */
export function normalizeAutoCastSpellIds(
  slots: readonly SpellId[],
  raw?: Partial<{ autoCast?: boolean[]; autoCastSpellIds?: SpellId[] }>,
): SpellId[] {
  if (raw?.autoCastSpellIds) {
    return dedupeAutoCastSpellIds(raw.autoCastSpellIds);
  }
  const legacy = raw?.autoCast;
  if (!legacy?.length) return createDefaultAutoCastSpellIds();
  const ids: SpellId[] = [];
  const n = Math.min(slots.length, legacy.length, SPELL_BAR.slotCount);
  for (let i = 0; i < n; i++) {
    if (!legacy[i]) continue;
    const id = slots[i] ?? "";
    if (id) ids.push(id);
  }
  return dedupeAutoCastSpellIds(ids);
}

export function toggleAutoCastSpellId(
  ids: readonly SpellId[],
  spellId: SpellId,
): SpellId[] {
  if (!spellId || !spellById(spellId)) return [...ids];
  const set = new Set(ids);
  if (set.has(spellId)) set.delete(spellId);
  else set.add(spellId);
  return [...set];
}

/** Per-slot border flags for HUD chrome (derived from spell ids + current slots). */
/** Drop auto-cast ids for spells that are no longer assigned to a bar slot. */
export function pruneAutoCastSpellIdsForSlots(
  autoCastSpellIds: readonly SpellId[],
  slots: readonly SpellId[],
): SpellId[] {
  const onBar = new Set(slots.filter(Boolean));
  return autoCastSpellIds.filter((id) => onBar.has(id));
}

export function autoCastFlagsForSlots(
  slots: readonly SpellId[],
  autoCastSpellIds: readonly SpellId[],
): boolean[] {
  const auto = new Set(autoCastSpellIds);
  return Array.from({ length: SPELL_BAR.slotCount }, (_, i) => {
    const id = slots[i] ?? "";
    return Boolean(id && auto.has(id));
  });
}
