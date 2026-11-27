/**
 * E2E-only damage tally for the real-fight harness (`npm run sim:fights`):
 * damage dealt to enemies by damage flavor (physical = weapons, elements =
 * spells, procs and bombs), so fights can be compared with the sim's power
 * model term by term.
 */
export type CombatTally = Record<string, { damage: number; hits: number }>;

/**
 * Spell casts started (by spell id), HP the player regained, and damage to
 * enemies by source: a spell id (its DoTs included), "melee" / "ranged"
 * weapon hits, "proc" (gear on-hit DoTs) or "other".
 */
export type CastTally = {
  casts: Record<string, number>;
  healed: number;
  bySource: CombatTally;
};

let tally: CombatTally = {};
let bySource: CombatTally = {};
let casts: Record<string, number> = {};
let healed = 0;

export function resetCombatTally(): void {
  tally = {};
  bySource = {};
  casts = {};
  healed = 0;
}

export function recordSpellCast(spellId: string): void {
  casts[spellId] = (casts[spellId] ?? 0) + 1;
}

export function recordPlayerHealed(amount: number): void {
  if (amount > 0) healed += amount;
}

/** Copy of the cast / heal tally since the last reset. */
export function castTally(): CastTally {
  return { casts: { ...casts }, healed, bySource: structuredClone(bySource) };
}

function add(into: CombatTally, key: string, amount: number): void {
  const row = into[key] ?? { damage: 0, hits: 0 };
  row.damage += amount;
  row.hits += 1;
  into[key] = row;
}

export function recordCombatDamage(
  flavor: string | undefined,
  amount: number,
  source?: string,
) {
  if (!(amount > 0)) return;
  add(tally, flavor || "physical", amount);
  add(bySource, source || "other", amount);
}

/** Copy of the tally since the last reset. */
export function combatTally(): CombatTally {
  return structuredClone(tally);
}
