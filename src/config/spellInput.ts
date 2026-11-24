export type SpellInputTuning = {
  /** Bearing change (degrees) from cast-start stick aim that cancels windup/channel. */
  castInterruptStickAngleDeg: number;
  /** Raw stick magnitude above which the player counts as moving (auto-cast / queue). */
  stickMovingMagnitudeEps: number;
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

export function applySpellInputTuning(tuning: SpellInputTuning): void {
  CAST_INTERRUPT_STICK_ANGLE_DEG = tuning.castInterruptStickAngleDeg;
  STICK_MOVING_MAGNITUDE_EPS = tuning.stickMovingMagnitudeEps;
}