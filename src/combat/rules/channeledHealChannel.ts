import { requireSpellNumber, type SpellDefinition } from "../../content/spells";
import { spellChannelTickMs } from "../../content/spellTargeting";

export type ChanneledHealTickState = {
  tickAccumMs: number;
  ticksDone: number;
  healApplied: number;
};

export function isChanneledHealSpell(def: SpellDefinition): boolean {
  return def.mechanicType === "heal" && def.channelMs > 0;
}

export function channeledHealMaxTicks(def: SpellDefinition): number {
  if (!isChanneledHealSpell(def)) return 0;
  const tickEvery = spellChannelTickMs(def);
  return Math.max(1, Math.floor(def.channelMs / tickEvery));
}

export function channeledHealTotalAmount(def: SpellDefinition): number {
  return requireSpellNumber(def, "healAmount");
}

export function channeledHealPerTickAmount(def: SpellDefinition): number {
  const maxTicks = channeledHealMaxTicks(def);
  if (maxTicks <= 0) return channeledHealTotalAmount(def);
  return Math.floor(channeledHealTotalAmount(def) / maxTicks);
}

export function channeledHealCompletionRemainder(def: SpellDefinition): number {
  const total = channeledHealTotalAmount(def);
  const perTick = channeledHealPerTickAmount(def);
  return total - perTick * channeledHealMaxTicks(def);
}

export function createChanneledHealTickState(): ChanneledHealTickState {
  return { tickAccumMs: 0, ticksDone: 0, healApplied: 0 };
}

/**
 * Accumulates channel time and returns how many heal ticks to apply this frame.
 * Matches {@link tickSpellGroundZones}: first tick after `channelTickMs`, then every interval.
 */
export function advanceChanneledHealTicks(
  state: ChanneledHealTickState,
  def: SpellDefinition,
  deltaMs: number,
): number {
  if (!isChanneledHealSpell(def)) return 0;
  const maxTicks = channeledHealMaxTicks(def);
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

export function channeledHealTickHealAmount(
  def: SpellDefinition,
  ticksFired: number,
): number {
  return channeledHealPerTickAmount(def) * ticksFired;
}
