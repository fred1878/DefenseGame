import { scaleUiX, scaleUiY } from "../core/displayScale";

export const SPELL_BAR = {
  slotCount: 6,
  columnCount: 3,
  rowCount: 2,
  slotSizePx: scaleUiX(48),
  slotGapPx: scaleUiX(3),
  rowGapPx: scaleUiY(4),
  tapPaddingPx: scaleUiX(4),
  cooldownRingWidthPx: scaleUiX(3),
  autoCastBorderWidthPx: scaleUiX(3),
  autoCastBorderColor: 0xfacc15,
  longPressMs: 520,
  fontSize: `${scaleUiX(11)}px`,
} as const;

export const CAST_BAR = {
  width: scaleUiX(48),
  height: scaleUiY(5),
  offsetY: scaleUiY(26),
  fillColor: 0xfef9c3,
  fillAlpha: 0.95,
  bgColor: 0x3f3f46,
  bgAlpha: 0.55,
  borderColor: 0xfffbeb,
  /** Foot ring — primary channel progress read (not a mystery world rect). */
  ringRadius: scaleUiX(22),
  ringLineWidth: scaleUiX(3),
  ringYOffset: scaleUiY(4),
  labelOffsetY: scaleUiY(-30),
  labelFontSize: `${scaleUiX(10)}px`,
} as const;

/** Per-spell colors for world-space channel indicator (fireball / heal). */
export const SPELL_CHANNEL_THEME: Record<
  string,
  { ring: number; track: number; fill: number; chip: number }
> = {
  fireball: {
    ring: 0xff8844,
    track: 0x422818,
    fill: 0xfbbf24,
    chip: 0xf97316,
  },
  heal: {
    ring: 0x4ade80,
    track: 0x14532d,
    fill: 0x86efac,
    chip: 0x22c55e,
  },
};

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