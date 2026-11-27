/**
 * "DG Theme" colours from the Figma panel mockups (27 variables, Gothic mode).
 * Keys mirror the Figma variable names (`bg/panel` → `bgPanel`). Rarity colours
 * here are only the design reference: panels show the live `items.json`
 * rarity colour for real items.
 */
export const DG_THEME = {
  bgAbyss: "#0C0A09",
  bgPanel: "#1A1613",
  bgRaised: "#241E19",
  bgSlot: "#12100D",
  bgSelected: "#2E2416",
  borderIron: "#3D342C",
  borderSteel: "#6B625A",
  accentGold: "#D4A64A",
  accentGoldBright: "#FBBF24",
  accentCrimson: "#9F1D2B",
  textPrimary: "#F4EDE1",
  textSecondary: "#B5AA9A",
  textMuted: "#7A7064",
  statePositive: "#4ADE80",
  stateNegative: "#F87171",
  rarityCommon: "#D4D4D8",
  rarityMagic: "#60A5FA",
  rarityRare: "#FACC15",
  rarityEpic: "#C084FC",
  rarityLegendary: "#FB923C",
  buttonBuy: "#8A5A0B",
  buttonEquip: "#166534",
  buttonSell: "#881337",
  buttonNeutral: "#3A322B",
  schoolFire: "#FB923C",
  schoolFrost: "#67E8F9",
  schoolArcane: "#A78BFA",
} as const;

export type DgThemeColor = keyof typeof DG_THEME;

/** Bright stroke paired with each filled button colour. */
export const DG_BUTTON_STROKE = {
  buy: DG_THEME.accentGold,
  equip: DG_THEME.statePositive,
  sell: "#FB7185",
  neutral: DG_THEME.borderSteel,
} as const;

/** Icon stroke tint (parchment) used across the panels. */
export const DG_ICON_TINT = "#E9DFCB";

/** Pixel title face (OFL): Departure Mono digits, then Pixelify Sans. */
export const DG_TITLE_FONT =
  '"DG Digits", "Pixelify Sans", system-ui, sans-serif';

/** `#RRGGBB` → 0xRRGGBB for Phaser fills / strokes / tints. */
export function hexToInt(hex: string): number {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  return Number.isFinite(n) ? n : 0xffffff;
}

/** Theme colour as a Phaser int. */
export function themeInt(key: DgThemeColor): number {
  return hexToInt(DG_THEME[key]);
}
