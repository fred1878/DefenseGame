export type SpellInputTuning = {
  /** Stick deflection delta from cast baseline that cancels windup/channel. */
  castInterruptStickDeltaEps: number;
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

export let CAST_INTERRUPT_STICK_DELTA_EPS = unsetSpellInputScalar(
  "CAST_INTERRUPT_STICK_DELTA_EPS",
);

export let STICK_MOVING_MAGNITUDE_EPS = unsetSpellInputScalar(
  "STICK_MOVING_MAGNITUDE_EPS",
);

export function applySpellInputTuning(tuning: SpellInputTuning): void {
  CAST_INTERRUPT_STICK_DELTA_EPS = tuning.castInterruptStickDeltaEps;
  STICK_MOVING_MAGNITUDE_EPS = tuning.stickMovingMagnitudeEps;
}