import type { SpellInputTuning } from "../../config/spellInput";
import { requireFiniteNumber, requireRecord } from "./configValidation";

export type SpellInputConfigInput = Partial<
  SpellInputTuning & { groundTapAutoCastSpellIds?: unknown }
>;

/** Boot-required keys for `public/data/spell_input.json` (see `DATA_FIELDS.md`). */
export const SPELL_INPUT_BOOT_KEYS = [
  "castInterruptStickAngleDeg",
  "stickMovingMagnitudeEps",
  "defaultGroundTargetMaxRangeWu",
  "groundAimFacingRangeFrac",
  "groundAimEnemyRadiusFrac",
  "instantTargetFallbackPx",
  "enemyTapRadiusWu",
] as const satisfies readonly (keyof SpellInputTuning)[];

export function normalizeSpellInput(
  raw: SpellInputConfigInput | null | undefined,
): SpellInputTuning {
  const root = requireRecord(raw, "spell_input");
  const out = {} as SpellInputTuning;
  for (const key of SPELL_INPUT_BOOT_KEYS) {
    out[key] = requireFiniteNumber(root[key], `spell_input.${key}`);
  }
  const tapIds = root.groundTapAutoCastSpellIds;
  out.groundTapAutoCastSpellIds = Array.isArray(tapIds)
    ? tapIds.filter((id): id is string => typeof id === "string")
    : [];
  return out;
}
