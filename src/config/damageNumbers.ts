import { setTuning, tuning } from "../tuning/gameTuning";
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
  aggregateWindowMs: number;
  fontFamily: string;
  fontWeight: string;
  offsetY: number;
  /** Numbers start this fraction of the sprite height above its centre. */
  anchorHeightFrac: number;
  styles: Record<DamageNumberKind, DamageNumberStyle>;
};

/** Authored part of {@link DamageNumbersConfig} (`public/data/damage-numbers.json`). */
export type DamageNumbersTuning = Omit<
  DamageNumbersConfig,
  "fontFamily" | "fontWeight"
>;

/** Apply `damage-numbers.json` (Boot / test setup); the font stays in code with its asset. */
export function applyDamageNumbers(next: DamageNumbersTuning): void {
  setTuning("damageNumbers", {
    ...next,
    fontFamily: DAMAGE_NUMBER_FONT_FAMILY,
    fontWeight: "700",
  });
}

/** Active damage-number config: `damage-numbers.json` plus the bundled font. */
export function damageNumbersConfig(): Readonly<DamageNumbersConfig> {
  return tuning("damageNumbers");
}

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
