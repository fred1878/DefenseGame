import { scaleUiX, scaleUiY } from "../core/displayScale";

export const SPELL_BAR = {
  slotCount: 3,
  slotSizePx: scaleUiX(56),
  slotGapPx: scaleUiX(4),
  tapPaddingPx: scaleUiX(4),
  cooldownRingWidthPx: scaleUiX(3),
  fontSize: `${scaleUiX(12)}px`,
} as const;

export const CAST_BAR = {
  width: scaleUiX(48),
  height: scaleUiY(6),
  offsetY: scaleUiY(26),
  fillColor: 0xfef9c3,
  fillAlpha: 0.95,
  bgColor: 0x3f3f46,
  bgAlpha: 0.7,
  borderColor: 0xfffbeb,
} as const;

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
  return SPELL_CATALOG.map((s) => s.id).slice(0, SPELL_BAR.slotCount);
}

export function spellById(id: SpellId): SpellDefinition | undefined {
  if (!id) return undefined;
  return SPELL_CATALOG.find((s) => s.id === id);
}