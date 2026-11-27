import {
  DAMAGE_NUMBER_KINDS,
  type DamageNumberMotion,
  type DamageNumberStyle,
  type DamageNumbersTuning,
} from "../../config/damageNumbers";
import {
  ConfigLoadError,
  optionalFiniteNumber,
  requireFiniteNumber,
  requireNumberFields,
  requireRecord,
} from "./configValidation";
import { requireString } from "./normalizeItems";

/** Boot-required top-level keys of `public/data/damage-numbers.json`. */
export const DAMAGE_NUMBERS_BOOT_KEYS = [
  "enabled",
  "maxActive",
  "aggregateWindowMs",
  "offsetY",
  "anchorHeightFrac",
  "styles",
] as const;

/** Boot-required keys on each `styles.<kind>` object (`prefix` is optional). */
export const DAMAGE_NUMBERS_STYLE_BOOT_KEYS = [
  "fill",
  "stroke",
  "strokeThickness",
  "fontSize",
  "critFontSize",
  "motion",
  "prefix",
] as const;

const MOTION_REQUIRED_KEYS = [
  "durationMs",
  "fadeStartT",
  "driftY",
  "driftX",
  "popScale",
  "popMs",
  "critPopScale",
] as const;
const MOTION_OPTIONAL_KEYS = [
  "flickerHz",
  "jitterPx",
  "waveAmp",
  "waveHz",
] as const;

/** Every key on a `styles.<kind>.motion` object (doc parity). */
export const DAMAGE_NUMBERS_MOTION_BOOT_KEYS = [
  ...MOTION_REQUIRED_KEYS,
  ...MOTION_OPTIONAL_KEYS,
] as const;

function normalizeMotion(raw: unknown, path: string): DamageNumberMotion {
  const block = requireRecord(raw, path);
  const out = requireNumberFields(
    block,
    MOTION_REQUIRED_KEYS,
    path,
  ) as DamageNumberMotion;
  for (const key of MOTION_OPTIONAL_KEYS) {
    const v = optionalFiniteNumber(block[key], `${path}.${key}`);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

function normalizeStyle(raw: unknown, path: string): DamageNumberStyle {
  const block = requireRecord(raw, path);
  const nums = requireNumberFields(
    block,
    ["strokeThickness", "fontSize", "critFontSize"],
    path,
  );
  const style: DamageNumberStyle = {
    fill: requireString(block.fill, `${path}.fill`),
    stroke: requireString(block.stroke, `${path}.stroke`),
    strokeThickness: nums.strokeThickness!,
    fontSize: nums.fontSize!,
    critFontSize: nums.critFontSize!,
    motion: normalizeMotion(block.motion, `${path}.motion`),
  };
  if (block.prefix !== undefined) {
    style.prefix = requireString(block.prefix, `${path}.prefix`);
  }
  return style;
}

export function normalizeDamageNumbers(raw: unknown): DamageNumbersTuning {
  const root = requireRecord(raw, "damage-numbers");
  if (typeof root.enabled !== "boolean") {
    throw new ConfigLoadError("Expected boolean at damage-numbers.enabled");
  }
  const styles = requireRecord(root.styles, "damage-numbers.styles");
  return {
    enabled: root.enabled,
    maxActive: requireFiniteNumber(root.maxActive, "damage-numbers.maxActive"),
    aggregateWindowMs: requireFiniteNumber(
      root.aggregateWindowMs,
      "damage-numbers.aggregateWindowMs",
    ),
    offsetY: requireFiniteNumber(root.offsetY, "damage-numbers.offsetY"),
    anchorHeightFrac: requireFiniteNumber(
      root.anchorHeightFrac,
      "damage-numbers.anchorHeightFrac",
    ),
    styles: Object.fromEntries(
      DAMAGE_NUMBER_KINDS.map((kind) => [
        kind,
        normalizeStyle(styles[kind], `damage-numbers.styles.${kind}`),
      ]),
    ) as DamageNumbersTuning["styles"],
  };
}
