/** Layout and feel for the defense HUD spell bar (implementation in a follow-up). */
export const SPELL_BAR = {
  slotCount: 4,
  slotSizePx: 52,
  slotGapPx: 8,
  /** Distance from bottom of screen to center of slot row */
  bottomInsetPx: 200,
  /** Extra hit slop on each slot */
  tapPaddingPx: 6,
  cooldownRingWidthPx: 3,
  fontSize: "13px",
} as const;

export type SpellId = string;

/** Minimal spell row for tuning / future `spells.json`. */
export type SpellDefinition = {
  id: SpellId;
  label: string;
  cooldownMs: number;
  /** Placeholder damage multiplier until combat hooks land */
  power: number;
};

/** Starter catalog — wire UI + casting in the spell-bar task */
export const SPELL_CATALOG: readonly SpellDefinition[] = [
  { id: "heal", label: "Heal", cooldownMs: 8000, power: 20 },
  { id: "nova", label: "Nova", cooldownMs: 6000, power: 25 },
  { id: "haste", label: "Haste", cooldownMs: 12000, power: 0 },
  { id: "barrier", label: "Barrier", cooldownMs: 10000, power: 0 },
] as const;

export function createDefaultSpellBarSlots(): SpellId[] {
  const equipped: SpellId[] = [];
  for (let i = 0; i < SPELL_BAR.slotCount; i++) {
    equipped.push(SPELL_CATALOG[i]?.id ?? "");
  }
  return equipped;
}

export function spellById(id: SpellId): SpellDefinition | undefined {
  if (!id) return undefined;
  return SPELL_CATALOG.find((s) => s.id === id);
}