import type { SpellDefinition } from "../content/spells";
import { spellChannelTickMs } from "../content/spellTargeting";

/** Cone channel ticks during {@link SpellDefinition.mechanicType} `channeled_cone`. */
export const CHANNELED_CONE_MAX_TICKS = 3;

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
  maxTicks: number = CHANNELED_CONE_MAX_TICKS,
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
  maxTicks: number = CHANNELED_CONE_MAX_TICKS,
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