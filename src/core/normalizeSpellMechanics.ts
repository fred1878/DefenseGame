import {
  SPELL_MECHANICS_DEFAULTS,
  type SpellMechanicsTuning,
} from "../combat/spellMechanics";

export type SpellMechanicsInput = Partial<{
  [K in keyof SpellMechanicsTuning]: number;
}>;

export function normalizeSpellMechanics(
  raw: SpellMechanicsInput | null | undefined,
): SpellMechanicsTuning {
  const base = SPELL_MECHANICS_DEFAULTS;
  if (!raw) return { ...base };
  return {
    swingRangeWu: finiteOr(raw.swingRangeWu, base.swingRangeWu),
    swingArcDeg: finiteOr(raw.swingArcDeg, base.swingArcDeg),
    coneRangeWu: finiteOr(raw.coneRangeWu, base.coneRangeWu),
    coneArcDeg: finiteOr(raw.coneArcDeg, base.coneArcDeg),
    chainLightningHops: finiteOr(raw.chainLightningHops, base.chainLightningHops),
    chainLightningHopRangeWu: finiteOr(
      raw.chainLightningHopRangeWu,
      base.chainLightningHopRangeWu,
    ),
    blinkDistanceWu: finiteOr(raw.blinkDistanceWu, base.blinkDistanceWu),
    iceWallDistanceWu: finiteOr(raw.iceWallDistanceWu, base.iceWallDistanceWu),
    iceWallDurationMs: finiteOr(raw.iceWallDurationMs, base.iceWallDurationMs),
    shadowformDurationMs: finiteOr(
      raw.shadowformDurationMs,
      base.shadowformDurationMs,
    ),
    shadowformDamageMult: finiteOr(
      raw.shadowformDamageMult,
      base.shadowformDamageMult,
    ),
    frostRootMs: finiteOr(raw.frostRootMs, base.frostRootMs),
    deepFreezeRootMs: finiteOr(raw.deepFreezeRootMs, base.deepFreezeRootMs),
  };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value! : fallback;
}