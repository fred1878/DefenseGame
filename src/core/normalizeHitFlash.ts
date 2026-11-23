import {
  DAMAGE_FLAVORS,
  type DamageFlavor,
} from "../combat/DamageSystem";
import {
  ConfigLoadError,
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";

export type HitFlashMode = "fill" | "multiply";

export type HitFlashFlavorEntry = {
  tint: number;
  mode: HitFlashMode;
  peakAlpha: number;
  colorFade: boolean;
  alphaFade: boolean;
};

export type HitFlashInput = {
  durationMs?: number;
  flavors?: Partial<Record<DamageFlavor, HitFlashFlavorInput>>;
};

export type HitFlashFlavorInput = {
  tint?: number;
  mode?: string;
  peakAlpha?: number;
  colorFade?: boolean;
  alphaFade?: boolean;
};

export type HitFlashConfig = {
  durationMs: number;
  flavors: Record<DamageFlavor, HitFlashFlavorEntry>;
};

/** Boot-required keys for `public/data/hit-flash.json` (see `DATA_FIELDS.md`). */
export const HIT_FLASH_BOOT_KEYS = ["durationMs", "flavors"] as const;

/** Required fields on each `flavors.<damageFlavor>` object. */
export const HIT_FLASH_FLAVOR_BOOT_KEYS = [
  "tint",
  "mode",
  "peakAlpha",
  "colorFade",
  "alphaFade",
] as const satisfies readonly (keyof HitFlashFlavorEntry)[];

function requireTint(value: unknown, path: string): number {
  const n = requireFiniteNumber(value, path);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffff) {
    throw new ConfigLoadError(
      `Expected integer tint 0..16777215 at ${path}`,
    );
  }
  return n;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new ConfigLoadError(`Expected boolean at ${path}`);
  }
  return value;
}

function requireHitFlashMode(value: unknown, path: string): HitFlashMode {
  if (value !== "fill" && value !== "multiply") {
    throw new ConfigLoadError(
      `Expected "fill" or "multiply" at ${path}`,
    );
  }
  return value;
}

function normalizeFlavorEntry(
  raw: unknown,
  path: string,
): HitFlashFlavorEntry {
  const entry = requireRecord(raw, path);
  return {
    tint: requireTint(entry.tint, `${path}.tint`),
    mode: requireHitFlashMode(entry.mode, `${path}.mode`),
    peakAlpha: requireFiniteNumber(entry.peakAlpha, `${path}.peakAlpha`),
    colorFade: requireBoolean(entry.colorFade, `${path}.colorFade`),
    alphaFade: requireBoolean(entry.alphaFade, `${path}.alphaFade`),
  };
}

export function normalizeHitFlash(
  raw: HitFlashInput | null | undefined,
): HitFlashConfig {
  const root = requireRecord(raw, "hit-flash");
  const flavorsRaw = requireRecord(root.flavors, "hit-flash.flavors");
  const flavors = {} as Record<DamageFlavor, HitFlashFlavorEntry>;
  for (const flavor of DAMAGE_FLAVORS) {
    flavors[flavor] = normalizeFlavorEntry(
      flavorsRaw[flavor],
      `hit-flash.flavors.${flavor}`,
    );
  }
  return {
    durationMs: requireFiniteNumber(
      root.durationMs,
      "hit-flash.durationMs",
    ),
    flavors,
  };
}