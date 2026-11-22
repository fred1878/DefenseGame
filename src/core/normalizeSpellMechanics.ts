import {
  ConfigLoadError,
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";

export type ShadowformMechanics = {
  moveSpeedMult: number;
  damageTakenMult: number;
  aggroRadiusMult: number;
};

export type SpellMechanicsInput = Partial<{
  shadowformMoveSpeedMult: number;
  shadowformDamageTakenMult: number;
  shadowformAggroRadiusMult: number;
}>;

export function normalizeSpellMechanics(
  raw: SpellMechanicsInput | null | undefined,
): ShadowformMechanics {
  const root = requireRecord(raw, "spell-mechanics");
  const moveSpeedMult = requireFiniteNumber(
    root.shadowformMoveSpeedMult,
    "spell-mechanics.shadowformMoveSpeedMult",
  );
  const damageTakenMult = requireFiniteNumber(
    root.shadowformDamageTakenMult,
    "spell-mechanics.shadowformDamageTakenMult",
  );
  const aggroRadiusMult = requireFiniteNumber(
    root.shadowformAggroRadiusMult,
    "spell-mechanics.shadowformAggroRadiusMult",
  );
  if (moveSpeedMult <= 0) {
    throw new ConfigLoadError(
      "spell-mechanics.shadowformMoveSpeedMult must be > 0",
    );
  }
  if (damageTakenMult < 0 || damageTakenMult > 1) {
    throw new ConfigLoadError(
      "spell-mechanics.shadowformDamageTakenMult must be in [0, 1]",
    );
  }
  if (aggroRadiusMult < 0 || aggroRadiusMult > 1) {
    throw new ConfigLoadError(
      "spell-mechanics.shadowformAggroRadiusMult must be in [0, 1]",
    );
  }
  return { moveSpeedMult, damageTakenMult, aggroRadiusMult };
}