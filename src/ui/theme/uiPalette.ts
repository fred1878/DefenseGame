/**
 * Named colours used across the UI, VFX and debug overlays (Tailwind-style
 * names where the value matches a Tailwind colour). Values are the exact
 * colours the code used before tokens, so swapping a literal for a token
 * never changes what is drawn. `PALETTE` holds Phaser ints; `PALETTE_CSS`
 * holds the same colours as `#rrggbb` strings for text styles.
 *
 * Panel-specific colours from the Figma mockups live in `dgTheme.ts`.
 */
const PALETTE_HEX = {
  white: "#ffffff",
  black: "#000000",
  zinc50: "#fafafa",
  zinc100: "#f4f4f5",
  zinc200: "#e4e4e7",
  zinc300: "#d4d4d8",
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  zinc600: "#52525b",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc950: "#09090b",
  red300: "#fca5a5",
  red400: "#f87171",
  red500: "#ef4444",
  red900: "#7f1d1d",
  rose400: "#fb7185",
  orange500: "#f97316",
  orange600: "#ea580c",
  amber200: "#fde68a",
  amber400: "#fbbf24",
  yellow400: "#facc15",
  green400: "#4ade80",
  green700: "#15803d",
  cyan300: "#67e8f9",
  cyan400: "#22d3ee",
  sky100: "#e0f2fe",
  sky400: "#38bdf8",
  blue300: "#93c5fd",
  blue400: "#60a5fa",
  blue700: "#1d4ed8",
  indigo400: "#818cf8",
  indigo500: "#6366f1",
  indigo900: "#312e81",
  indigo950: "#1e1b4b",
  fuchsia500: "#d946ef",
  fuchsia600: "#c026d3",
  /** Material palette (spell VFX). */
  materialOrange300: "#ffb74d",
  materialOrange500: "#ff9800",
  materialYellow200: "#fff59d",
  materialYellow300: "#fff176",
  /** Custom tones. */
  deepNavy: "#1e3a5f",
  softSky: "#7db8ff",
  parchment: "#e9dfcb",
  parchmentDim: "#e8dcc8",
} as const;

export type PaletteColor = keyof typeof PALETTE_HEX;

export const PALETTE_CSS: Readonly<Record<PaletteColor, string>> = PALETTE_HEX;

export const PALETTE: Readonly<Record<PaletteColor, number>> =
  Object.fromEntries(
    Object.entries(PALETTE_HEX).map(([k, v]) => [
      k,
      Number.parseInt(v.slice(1), 16),
    ]),
  ) as Record<PaletteColor, number>;
