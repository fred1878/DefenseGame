import type { SpellInputTuning } from "../config/spellInput";
import { requireFiniteNumber, requireRecord } from "./configValidation";

export type SpellInputConfigInput = Partial<SpellInputTuning>;

/** Boot-required keys for `public/data/spell_input.json` (see `DATA_FIELDS.md`). */
export const SPELL_INPUT_BOOT_KEYS = [
  "castInterruptStickDeltaEps",
  "stickMovingMagnitudeEps",
] as const satisfies readonly (keyof SpellInputTuning)[];

export function normalizeSpellInput(
  raw: SpellInputConfigInput | null | undefined,
): SpellInputTuning {
  const root = requireRecord(raw, "spell_input");
  const out = {} as SpellInputTuning;
  for (const key of SPELL_INPUT_BOOT_KEYS) {
    out[key] = requireFiniteNumber(root[key], `spell_input.${key}`);
  }
  return out;
}