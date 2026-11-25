export type SpellInputTuning = {
  /** Bearing change (degrees) from cast-start stick aim that cancels windup/channel. */
  castInterruptStickAngleDeg: number;
  /** Raw stick magnitude above which the player counts as moving (auto-cast / queue). */
  stickMovingMagnitudeEps: number;
  /**
   * Targeted ground AoE ids (Boot overwrites from spell catalog via `deriveGroundTapAutoCastSpellIds`).
   * JSON may list ids for documentation; runtime tap-cast uses `spellUsesManualGroundAim`.
   */
  groundTapAutoCastSpellIds: readonly string[];
};

function unsetSpellInputScalar(label: string): number {
  return new Proxy({} as object, {
    get() {
      throw new Error(
        `${label} not loaded — Boot must apply public/data/spell_input.json`,
      );
    },
  }) as unknown as number;
}

export let CAST_INTERRUPT_STICK_ANGLE_DEG = unsetSpellInputScalar(
  "CAST_INTERRUPT_STICK_ANGLE_DEG",
);

export let STICK_MOVING_MAGNITUDE_EPS = unsetSpellInputScalar(
  "STICK_MOVING_MAGNITUDE_EPS",
);

export let GROUND_TAP_AUTO_CAST_SPELL_IDS: readonly string[] = new Proxy(
  [] as readonly string[],
  {
    get() {
      throw new Error(
        "GROUND_TAP_AUTO_CAST_SPELL_IDS not loaded — Boot must apply public/data/spell_input.json",
      );
    },
  },
);

export function applySpellInputTuning(tuning: SpellInputTuning): void {
  CAST_INTERRUPT_STICK_ANGLE_DEG = tuning.castInterruptStickAngleDeg;
  STICK_MOVING_MAGNITUDE_EPS = tuning.stickMovingMagnitudeEps;
  GROUND_TAP_AUTO_CAST_SPELL_IDS = tuning.groundTapAutoCastSpellIds;
}
