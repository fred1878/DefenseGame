import { isSpellPoolSelectable } from "../../content/spellPoolReadiness";
import {
  type SpellDefinition,
  type SpellId,
  spellById,
} from "../../content/spells";

/**
 * Spells at or under this cooldown are always (nearly) ready: fillers.
 * Auto-cast takes the first ready slot, so a filler stops everything after
 * it from ever being cast; a bar wants exactly one, in the last slot.
 */
export const FILLER_MAX_COOLDOWN_MS = 150;

function damagePerCast(def: SpellDefinition): number {
  return (
    (def.baseDamage ?? 0) +
    (def.burstDamage ?? 0) +
    ((def.onHit?.dotDps ?? 0) * (def.onHit?.dotMs ?? 0)) / 1000
  );
}

/**
 * A damage spell that is ready again as soon as it finishes: no cooldown to
 * speak of, or a channel at least as long as its cooldown (channelled
 * spells arm their cooldown when the channel starts, e.g. blizzard: 1.5 s
 * cooldown, 4 s channel).
 */
export function isFillerSpell(def: SpellDefinition): boolean {
  if (damagePerCast(def) <= 0) return false;
  if (def.cooldownMs <= FILLER_MAX_COOLDOWN_MS) return true;
  return def.channelMs > 0 && def.cooldownMs <= def.channelMs;
}

/** Single-target damage per second of a filler cast back to back. */
export function fillerDps(def: SpellDefinition): number {
  const cycle = Math.max((def.castMs ?? 0) + def.channelMs, def.cooldownMs, 50);
  return (damagePerCast(def) * 1000) / cycle;
}

const isHeal = (def: SpellDefinition) => def.mechanicType === "heal";

function defsOf(ids: readonly SpellId[]): SpellDefinition[] {
  const seen = new Set<SpellId>();
  const out: SpellDefinition[] = [];
  for (const id of ids) {
    const def = spellById(id);
    if (!def || seen.has(def.id)) continue;
    seen.add(def.id);
    out.push(def);
  }
  return out;
}

const byCooldown = (a: SpellDefinition, b: SpellDefinition) =>
  b.cooldownMs - a.cooldownMs;

/**
 * Auto-cast bar for the fight bot and the sim: every cooldown spell
 * (damage, control and heals) longest cooldown first, then exactly one
 * filler last (`filler`, else the save's highest-DPS one). Other fillers
 * are dropped, since auto-cast would never reach them.
 */
export function autoCastOrder(
  slots: readonly SpellId[],
  filler?: SpellId,
): SpellId[] {
  const defs = defsOf(slots);
  const main = defs.filter((d) => !isFillerSpell(d)).sort(byCooldown);
  const chosen =
    (filler && spellById(filler)) ||
    defs.filter(isFillerSpell).sort((a, b) => fillerDps(b) - fillerDps(a))[0];
  return [...main, ...(chosen ? [chosen] : [])].map((d) => d.id);
}

/** Element-focused bars the fight tools can swap in for a save. */
export const ELEMENT_BARS = {
  // Fire's five best cooldown spells by damage per cooldown second.
  fire: {
    spells: [
      "cone_of_fire",
      "flamestrike",
      "combustion",
      "arc_bomb",
      "fire_nova",
    ],
    filler: "fire_bolt",
  },
  frost: {
    spells: ["cone_of_cold", "deep_freeze", "frost_nova", "ice_wall"],
    filler: "blizzard",
  },
  "frost-bolt": {
    spells: ["cone_of_cold", "deep_freeze", "frost_nova", "ice_wall"],
    filler: "ice_bolt",
  },
  lightning: {
    spells: ["chain_lightning", "lightning_bolt"],
    filler: undefined,
  },
} as const satisfies Record<
  string,
  { spells: readonly SpellId[]; filler: SpellId | undefined }
>;

export type ElementBar = keyof typeof ELEMENT_BARS;

/**
 * An element-focused bar built from the save's own: that element's
 * pool-selectable spells first (cooldown order), then heals (`heal` and
 * `flash_heal`, whether or not the save had them) and, while slots remain,
 * the save's other cooldown spells, in cooldown order; then one filler (the
 * element's own, else the save's best). Only spells a player can put on the
 * bar are used.
 */
export function elementBar(
  saveSlots: readonly SpellId[],
  element: ElementBar,
  slotCount: number,
): SpellId[] {
  const spec = ELEMENT_BARS[element];
  const legal = (d: SpellDefinition) => isSpellPoolSelectable(d);
  const own = autoCastOrder(saveSlots);
  const ownFiller = own
    .map((id) => spellById(id)!)
    .find((d) => isFillerSpell(d));
  const filler =
    (spec.filler && spellById(spec.filler)) || ownFiller || undefined;
  const heals = defsOf(["heal", "flash_heal", ...own])
    .filter((d) => isHeal(d) && legal(d))
    .sort(byCooldown);
  const lead = defsOf(spec.spells).filter(legal).sort(byCooldown);
  const room = slotCount - lead.length - heals.length - (filler ? 1 : 0);
  const others = defsOf(own)
    .filter(
      (d) =>
        legal(d) &&
        !isHeal(d) &&
        !isFillerSpell(d) &&
        !lead.some((l) => l.id === d.id),
    )
    .slice(0, Math.max(0, room));
  const rest = [...heals, ...others].sort(byCooldown);
  return [...lead, ...rest]
    .slice(0, slotCount - (filler ? 1 : 0))
    .concat(filler ? [filler] : [])
    .map((d) => d.id);
}
