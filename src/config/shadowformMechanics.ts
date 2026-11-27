import { setTuning } from "../tuning/gameTuning";

export type ShadowformMechanics = {
  moveSpeedMult: number;
  damageTakenMult: number;
  aggroRadiusMult: number;
};

/** Set after spells.json loads (Boot). Read with `tuning("shadowform")`. */
export function applyShadowformMechanics(mechanics: ShadowformMechanics): void {
  setTuning("shadowform", mechanics);
}
