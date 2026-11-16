import { scaleUiX, scaleUiY } from "../core/displayScale";

export const SPELL_BAR = {
  slotCount: 8,
  columnCount: 4,
  rowCount: 2,
  /** Gothic frame art is 64×64; size fits four columns before MEL on 540-wide. */
  slotSizePx: scaleUiX(34),
  slotGapPx: scaleUiX(2),
  rowGapPx: scaleUiY(3),
  tapPaddingPx: scaleUiX(3),
  /** Inset inside Gothic frame before icon edge (fraction of slot size). */
  iconInsetFrac: 0.07,
  cooldownRingWidthPx: scaleUiX(3),
  autoCastBorderWidthPx: scaleUiX(2),
  autoCastBorderColor: 0xfacc15,
  longPressMs: 520,
  fontSize: `${scaleUiX(11)}px`,
} as const;

/** On-screen spell icon size inside a slot (defense HUD + town sort panel). */
export function spellBarIconDisplayPx(): number {
  const pad = Math.round(SPELL_BAR.slotSizePx * SPELL_BAR.iconInsetFrac);
  return SPELL_BAR.slotSizePx - pad;
}

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