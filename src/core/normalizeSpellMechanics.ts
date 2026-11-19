import type { SpellMechanicsTuning } from "../combat/spellMechanics";
import { requireRecord, requireFiniteNumber } from "./configValidation";

export type SpellMechanicsInput = Partial<{
  [K in keyof SpellMechanicsTuning]: number;
}>;

const SPELL_MECHANICS_KEYS = [
  "swingRangeWu",
  "swingArcDeg",
  "coneRangeWu",
  "coneArcDeg",
  "chainLightningHops",
  "chainLightningHopRangeWu",
  "blinkDistanceWu",
  "iceWallDistanceWu",
  "iceWallDurationMs",
  "shadowformDurationMs",
  "shadowformDamageMult",
  "frostRootMs",
  "deepFreezeRootMs",
] as const satisfies readonly (keyof SpellMechanicsTuning)[];

export function normalizeSpellMechanics(
  raw: SpellMechanicsInput | null | undefined,
): SpellMechanicsTuning {
  const root = requireRecord(raw, "spell-mechanics");
  const out = {} as SpellMechanicsTuning;
  for (const key of SPELL_MECHANICS_KEYS) {
    (out as Record<string, number>)[key] = requireFiniteNumber(
      root[key],
      `spell-mechanics.${key}`,
    );
  }
  return out;
}