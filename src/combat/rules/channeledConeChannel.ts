import type { SpellDefinition } from "../../content/spells";
import { spellChannelTickMs } from "../../content/spellTargeting";

/**
 * Cone strikes per `channeled_cone` cast: `channelMs / channelTickMs` from the
 * spell row (750 / 250 = 3 for Cone of Fire), at least one.
 */
export function channeledConeMaxTicks(def: SpellDefinition): number {
  return Math.max(1, Math.floor(def.channelMs / spellChannelTickMs(def)));
}

export type ChanneledConeTickState = {
  tickAccumMs: number;
  ticksDone: number;
};

export function createChanneledConeTickState(): ChanneledConeTickState {
  return { tickAccumMs: 0, ticksDone: 0 };
}

/** Channel duration aligned with ground-zone tick cadence (first tick after one interval). */
export function channeledConeChannelMs(
  def: SpellDefinition,
  maxTicks: number = channeledConeMaxTicks(def),
): number {
  return spellChannelTickMs(def) * maxTicks;
}

/**
 * Accumulates channel time and returns how many cone strikes to fire this frame.
 * Matches {@link tickSpellGroundZones}: first damage tick after `channelTickMs`, then every interval.
 */
export function advanceChanneledConeTicks(
  state: ChanneledConeTickState,
  def: SpellDefinition,
  deltaMs: number,
  maxTicks: number = channeledConeMaxTicks(def),
): number {
  const tickEvery = spellChannelTickMs(def);
  state.tickAccumMs += deltaMs;
  let fired = 0;
  while (state.ticksDone < maxTicks && state.tickAccumMs >= tickEvery) {
    state.tickAccumMs -= tickEvery;
    state.ticksDone += 1;
    fired += 1;
  }
  return fired;
}
