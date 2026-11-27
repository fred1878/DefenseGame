import { setTuning } from "../tuning/gameTuning";

export type SpellInputTuning = {
  /** Bearing change (degrees) from cast-start stick aim that cancels windup/channel. */
  castInterruptStickAngleDeg: number;
  /** Raw stick magnitude above which the player counts as moving (auto-cast / queue). */
  stickMovingMagnitudeEps: number;
  /** With no enemy to aim at, ground spells land this fraction of max range ahead. */
  groundAimFacingRangeFrac: number;
  /** Enemy hit radius for ground-aim picking, as a fraction of sprite display width. */
  groundAimEnemyRadiusFrac: number;
  /** Instant-target spell VFX travel (px) along facing when no enemy is hit. */
  instantTargetFallbackPx: number;
  /** Tap radius (WU) on enemy sprites for focus selection. */
  enemyTapRadiusWu: number;
  /**
   * Targeted ground AoE ids (Boot overwrites from spell catalog via `deriveGroundTapAutoCastSpellIds`).
   * JSON may list ids for documentation; runtime tap-cast uses `spellUsesManualGroundAim`.
   */
  groundTapAutoCastSpellIds: readonly string[];
};

/** Replace spell input tuning after `public/data/spell_input.json` loads (Boot). Read with `tuning("spellInput")`. */
export function applySpellInputTuning(next: SpellInputTuning): void {
  setTuning("spellInput", next);
}
