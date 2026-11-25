/**
 * Tunable floating damage-number presentation for Defense night.
 * Visual kinds cover every combat DamageFlavor plus heal and reserved
 * poison/plague styling for future sources.
 */

export const DAMAGE_NUMBER_KINDS = [
  "physical",
  "fire",
  "frost",
  "lightning",
  "water",
  "poison",
  "heal",
] as const;

export type DamageNumberKind = (typeof DAMAGE_NUMBER_KINDS)[number];

/** Font family registered via Phaser `load.font` / CSS @font-face. */
export const DAMAGE_NUMBER_FONT_FAMILY = "Pixelify Sans";

/** Public path (appended to Vite `BASE_URL`). Variable font, used at weight 700. */
export const DAMAGE_NUMBER_FONT_PATH =
  "fonts/pixelify-sans/PixelifySans-Variable.ttf";

export type DamageNumberMotion = {
  /** Total lifetime of a floater, milliseconds. */
  durationMs: number;
  /** Start fading once elapsed / duration reaches this 0–1 threshold. */
  fadeStartT: number;
  /** World-pixel rise (negative is up). */
  driftY: number;
  /** Constant horizontal drift over the lifetime. */
  driftX: number;
  /** Start scale of the punch-in, easing toward 1. */
  popScale: number;
  /** How long the punch-in lasts, milliseconds. */
  popMs: number;
  /** Crit punch-in scale. */
  critPopScale: number;
  /** Optional fire-style alpha flicker frequency in Hz. */
  flickerHz?: number;
  /** Optional lightning-style position shake in world pixels. */
  jitterPx?: number;
  /** Optional sine-wave horizontal amplitude (water / poison). */
  waveAmp?: number;
  /** Wave frequency in Hz. */
  waveHz?: number;
};

export type DamageNumberStyle = {
  fill: string;
  stroke: string;
  strokeThickness: number;
  /** Design pixels; scaled with `scaleUiX` at draw time. */
  fontSize: number;
  critFontSize: number;
  motion: DamageNumberMotion;
  prefix?: string;
};

export type DamageNumbersConfig = {
  enabled: boolean;
  maxActive: number;
  /** Hits on the same target + kind within this window merge. */
  aggregateWindowMs: number;
  fontFamily: string;
  fontWeight: string;
  /** Added to the default “above sprite” offset, design pixels. */
  offsetY: number;
  styles: Record<DamageNumberKind, DamageNumberStyle>;
};

const BASE_MOTION: DamageNumberMotion = {
  durationMs: 800,
  fadeStartT: 0.45,
  driftY: -36,
  driftX: 0,
  popScale: 1.35,
  popMs: 120,
  critPopScale: 1.7,
};

export const DAMAGE_NUMBERS: DamageNumbersConfig = {
  enabled: true,
  maxActive: 32,
  aggregateWindowMs: 120,
  fontFamily: DAMAGE_NUMBER_FONT_FAMILY,
  fontWeight: "700",
  offsetY: -6,
  styles: {
    physical: {
      fill: "#f4f4f5",
      stroke: "#18181b",
      strokeThickness: 4,
      fontSize: 18,
      critFontSize: 26,
      motion: { ...BASE_MOTION },
    },
    fire: {
      fill: "#ff8a2a",
      stroke: "#4a1a00",
      strokeThickness: 4,
      fontSize: 18,
      critFontSize: 26,
      motion: {
        ...BASE_MOTION,
        durationMs: 740,
        flickerHz: 14,
        popScale: 1.4,
      },
    },
    frost: {
      fill: "#c8eeff",
      stroke: "#16324a",
      strokeThickness: 4,
      fontSize: 18,
      critFontSize: 26,
      motion: {
        ...BASE_MOTION,
        durationMs: 920,
        driftY: -28,
        popScale: 1.2,
      },
    },
    lightning: {
      fill: "#ffe566",
      stroke: "#3f2a00",
      strokeThickness: 4,
      fontSize: 18,
      critFontSize: 26,
      motion: {
        ...BASE_MOTION,
        durationMs: 680,
        jitterPx: 3,
        popScale: 1.45,
      },
    },
    water: {
      fill: "#7dd3fc",
      stroke: "#0c4a6e",
      strokeThickness: 4,
      fontSize: 18,
      critFontSize: 26,
      motion: {
        ...BASE_MOTION,
        durationMs: 860,
        waveAmp: 8,
        waveHz: 2.2,
      },
    },
    poison: {
      fill: "#86ef45",
      stroke: "#14532d",
      strokeThickness: 4,
      fontSize: 18,
      critFontSize: 26,
      motion: {
        ...BASE_MOTION,
        durationMs: 980,
        driftY: -22,
        waveAmp: 5,
        waveHz: 1.4,
        popScale: 1.15,
      },
    },
    heal: {
      fill: "#4ade80",
      stroke: "#052e16",
      strokeThickness: 4,
      fontSize: 18,
      critFontSize: 26,
      prefix: "+",
      motion: {
        ...BASE_MOTION,
        durationMs: 900,
        driftY: -42,
        popScale: 1.25,
      },
    },
  },
};

/** Queue the Bold instance of Pixelify Sans on a Phaser loader. */
export function queueDamageNumberFont(
  loader: {
    font: (config: {
      key: string;
      url: string;
      format: string;
      descriptors: { weight: string; style: string };
    }) => unknown;
  },
  url: string = DAMAGE_NUMBER_FONT_PATH,
): void {
  loader.font({
    key: DAMAGE_NUMBER_FONT_FAMILY,
    url,
    format: "truetype",
    descriptors: { weight: "700", style: "normal" },
  });
}
