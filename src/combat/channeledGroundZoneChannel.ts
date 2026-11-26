import type { SpellDefinition } from "../content/spells";
import { spellChannelTickMs } from "../content/spellTargeting";

/** Tick count for a channeled ground zone (matches {@link tickSpellGroundZones} cadence). */
export function channeledGroundZoneMaxTicks(def: SpellDefinition): number {
  const channelMs = def.channelMs ?? 0;
  if (channelMs <= 0) return 1;
  const tickEvery = spellChannelTickMs(def);
  return Math.max(1, Math.floor(channelMs / tickEvery));
}

export function channeledGroundZoneTotalDamage(
  def: SpellDefinition,
  damageMult: number,
): number {
  return (def.baseDamage ?? 0) * damageMult;
}

export function channeledGroundZonePerTickDamage(
  def: SpellDefinition,
  damageMult: number,
): number {
  const maxTicks = channeledGroundZoneMaxTicks(def);
  const total = channeledGroundZoneTotalDamage(def, damageMult);
  return Math.floor(total / maxTicks);
}

export function channeledGroundZoneCompletionRemainder(
  def: SpellDefinition,
  damageMult: number,
): number {
  const total = channeledGroundZoneTotalDamage(def, damageMult);
  const perTick = channeledGroundZonePerTickDamage(def, damageMult);
  return total - perTick * channeledGroundZoneMaxTicks(def);
}
