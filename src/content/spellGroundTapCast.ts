import { GROUND_TAP_AUTO_CAST_SPELL_IDS } from "../config/spellInput";

/** Short spell-bar tap auto-aims ground spells listed in `spell_input.json`. */
export function spellGroundTapAutoCasts(spellId: string): boolean {
  return GROUND_TAP_AUTO_CAST_SPELL_IDS.includes(spellId);
}