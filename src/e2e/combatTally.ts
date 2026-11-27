/**
 * E2E-only damage tally for the real-fight harness (`npm run sim:fights`):
 * damage dealt to enemies by damage flavor (physical = weapons, elements =
 * spells, procs and bombs), so fights can be compared with the sim's power
 * model term by term.
 */
export type CombatTally = Record<string, { damage: number; hits: number }>;

/** Spell casts started (by spell id) and HP the player regained. */
export type CastTally = { casts: Record<string, number>; healed: number };

let tally: CombatTally = {};
let casts: Record<string, number> = {};
let healed = 0;

export function resetCombatTally(): void {
  tally = {};
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
  return { casts: { ...casts }, healed };
}

export function recordCombatDamage(flavor: string | undefined, amount: number) {
  if (!(amount > 0)) return;
  const key = flavor || "physical";
  const row = tally[key] ?? { damage: 0, hits: 0 };
  row.damage += amount;
  row.hits += 1;
  tally[key] = row;
}

/** Copy of the tally since the last reset. */
export function combatTally(): CombatTally {
  return structuredClone(tally);
}
