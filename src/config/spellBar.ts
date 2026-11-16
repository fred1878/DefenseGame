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

const TOWN_SORT_BAR_SCALE = 2;

/**
 * Town spell-sort overlay chrome (legacy 844-tall design units — apply scaleUiY / scaleUiX).
 * Bar grid top is below the wrapped hint so 2× slots do not cover instruction copy.
 */
export const TOWN_SPELL_SORT_PANEL = {
  titleY: 64,
  hintY: 98,
  barGridTopY: 200,
  poolBelowBarGapY: 28,
  poolHeaderToGridGapY: 24,
  doneBelowPoolGapY: 28,
} as const;

/** Town spell-sort overlay: 2× defense bar slots (icons + hit targets). */
export const TOWN_SPELL_SORT_BAR = {
  columnCount: SPELL_BAR.columnCount,
  rowCount: SPELL_BAR.rowCount,
  slotSizePx: SPELL_BAR.slotSizePx * TOWN_SORT_BAR_SCALE,
  slotGapPx: SPELL_BAR.slotGapPx * TOWN_SORT_BAR_SCALE,
  rowGapPx: SPELL_BAR.rowGapPx * TOWN_SORT_BAR_SCALE,
  autoCastBorderWidthPx: SPELL_BAR.autoCastBorderWidthPx * TOWN_SORT_BAR_SCALE,
  autoCastBorderColor: SPELL_BAR.autoCastBorderColor,
  longPressMs: SPELL_BAR.longPressMs,
  iconInsetFrac: SPELL_BAR.iconInsetFrac,
} as const;

/** On-screen spell icon size inside a slot (defense HUD). */
export function spellBarIconDisplayPx(): number {
  const pad = Math.round(SPELL_BAR.slotSizePx * SPELL_BAR.iconInsetFrac);
  return SPELL_BAR.slotSizePx - pad;
}

/** On-screen spell icon size in the town sort overlay (2× defense). */
export function townSpellBarIconDisplayPx(): number {
  const pad = Math.round(
    TOWN_SPELL_SORT_BAR.slotSizePx * TOWN_SPELL_SORT_BAR.iconInsetFrac,
  );
  return TOWN_SPELL_SORT_BAR.slotSizePx - pad;
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