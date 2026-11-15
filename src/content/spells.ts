import { SPELL_BAR } from "../config/spellBar";

export type SpellId = string;
export type SpellCastKind = "instant" | "channeled";

export type SpellDefinition = {
  id: SpellId;
  label: string;
  shortLabel: string;
  cooldownMs: number;
  channelMs: number;
  kind: SpellCastKind;
  novaRadius?: number;
  novaDamage?: number;
  fireballDamage?: number;
  healAmount?: number;
};

export const SPELL_CATALOG: readonly SpellDefinition[] = [
  {
    id: "nova",
    label: "Nova",
    shortLabel: "Nova",
    cooldownMs: 5000,
    channelMs: 0,
    kind: "instant",
    novaRadius: 88,
    novaDamage: 22,
  },
  {
    id: "fireball",
    label: "Fireball",
    shortLabel: "Fire",
    cooldownMs: 4500,
    channelMs: 1200,
    kind: "channeled",
    fireballDamage: 28,
  },
  {
    id: "heal",
    label: "Heal",
    shortLabel: "Heal",
    cooldownMs: 7000,
    channelMs: 1500,
    kind: "channeled",
    healAmount: 24,
  },
] as const;

export function createDefaultSpellBarSlots(): SpellId[] {
  const slots: SpellId[] = SPELL_CATALOG.map((s) => s.id);
  while (slots.length < SPELL_BAR.slotCount) slots.push("");
  return slots.slice(0, SPELL_BAR.slotCount);
}

export function createDefaultSpellBarAutoCast(): boolean[] {
  return Array.from({ length: SPELL_BAR.slotCount }, () => false);
}

export function spellById(id: SpellId): SpellDefinition | undefined {
  if (!id) return undefined;
  return SPELL_CATALOG.find((s) => s.id === id);
}